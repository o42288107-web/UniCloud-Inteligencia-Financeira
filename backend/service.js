const db = require('./db');
const queries = require('./queries');
const dbConfig = require('./db_config_service');
const manualExpenseService = require('./manual_expense_service');

function toNumber(value) {
    const parsed = parseFloat(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeAccountId(value) {
    return String(value ?? '');
}

function recalculateMainRows(rows) {
    const totalDespesas = rows.reduce((sum, row) => sum + toNumber(row.total_despesa), 0);
    const totalFaturamento = rows.length ? toNumber(rows[0].total_faturamento) : 0;

    return rows
        .map((row) => {
            const totalDespesa = toNumber(row.total_despesa);
            return {
                ...row,
                total_despesa: totalDespesa,
                total_despesas: totalDespesas,
                total_faturamento: totalFaturamento,
                frac_sobre_desp_total: totalDespesas ? totalDespesa / totalDespesas : 0,
                frac_sobre_faturamento: totalFaturamento ? totalDespesa / totalFaturamento : 0,
                perc_sobre_desp_total: totalDespesas ? (totalDespesa / totalDespesas) * 100 : 0,
                perc_sobre_faturamento: totalFaturamento ? (totalDespesa / totalFaturamento) * 100 : 0
            };
        })
        .sort((a, b) => toNumber(b.total_despesa) - toNumber(a.total_despesa));
}

function mergeManualIntoMainRows(erpRows, manualAccounts, manualExpenses) {
    const rows = erpRows.map((row) => ({
        ...row,
        id_conta: normalizeAccountId(row.id_conta),
        account_source: 'erp',
        total_despesa: toNumber(row.total_despesa),
        erp_total_despesa: toNumber(row.total_despesa),
        manual_total_despesa: 0
    }));
    const rowById = new Map(rows.map((row) => [normalizeAccountId(row.id_conta), row]));
    const totalFaturamento = rows.length ? toNumber(rows[0].total_faturamento) : 0;

    manualAccounts.forEach((account) => {
        const accountId = normalizeAccountId(account.id);
        if (rowById.has(accountId)) return;

        const row = {
            id_conta: accountId,
            conta: account.name,
            total_despesa: 0,
            total_despesas: 0,
            total_faturamento: totalFaturamento,
            account_source: 'manual',
            erp_total_despesa: 0,
            manual_total_despesa: 0
        };
        rows.push(row);
        rowById.set(accountId, row);
    });

    manualExpenses.forEach((expense) => {
        const accountId = normalizeAccountId(expense.accountId);
        let row = rowById.get(accountId);

        if (!row) {
            const manualAccount = manualAccounts.find((account) => account.id === accountId);
            row = {
                id_conta: accountId,
                conta: expense.accountName || manualAccount?.name || 'Conta manual',
                total_despesa: 0,
                total_despesas: 0,
                total_faturamento: totalFaturamento,
                account_source: expense.accountSource === 'erp' ? 'erp' : 'manual',
                erp_total_despesa: 0,
                manual_total_despesa: 0
            };
            rows.push(row);
            rowById.set(accountId, row);
        }

        const amount = toNumber(expense.amount);
        row.total_despesa += amount;
        row.manual_total_despesa += amount;
    });

    return recalculateMainRows(rows);
}

function mergeManualIntoMonthlyRows(erpRows, manualExpenses) {
    const rows = erpRows.map((row) => ({
        ...row,
        total_despesa_mes: toNumber(row.total_despesa_mes),
        total_faturamento_mes: toNumber(row.total_faturamento_mes)
    }));
    const byMonth = new Map(rows.map((row) => [`${row.ano}-${row.mes}`, row]));

    manualExpenses.forEach((expense) => {
        const [year, month] = String(expense.date || '').split('-').map(Number);
        if (!year || !month) return;

        const key = `${year}-${month}`;
        let row = byMonth.get(key);
        if (!row) {
            row = {
                ano: year,
                mes: month,
                total_despesa_mes: 0,
                total_faturamento_mes: 0,
                perc_desp_fat_mes: 0
            };
            rows.push(row);
            byMonth.set(key, row);
        }
        row.total_despesa_mes += toNumber(expense.amount);
    });

    return rows
        .map((row) => ({
            ...row,
            perc_desp_fat_mes: toNumber(row.total_faturamento_mes)
                ? (toNumber(row.total_despesa_mes) / toNumber(row.total_faturamento_mes)) * 100
                : 0
        }))
        .sort((a, b) => (Number(a.ano) - Number(b.ano)) || (Number(a.mes) - Number(b.mes)));
}

function buildTop10FromMainRows(rows) {
    return rows
        .map((row) => ({
            conta: row.conta,
            total_despesa: toNumber(row.total_despesa),
            account_source: row.account_source
        }))
        .sort((a, b) => b.total_despesa - a.total_despesa)
        .slice(0, 10);
}

function mapManualHistory(expense) {
    return {
        datahora: expense.date,
        historico: expense.history,
        documento: expense.document,
        forn_cliente: expense.entity,
        valor: expense.amount,
        origem: 'Manual',
        observacao: expense.observation,
        filial: expense.branchName
    };
}

async function getManualData(startDate, endDate, branch) {
    const [accountsResult, expensesResult] = await Promise.all([
        manualExpenseService.listAccounts({ activeOnly: true }),
        manualExpenseService.listExpenses({ startDate, endDate, branch })
    ]);

    return {
        accounts: accountsResult.success ? accountsResult.data : [],
        expenses: expensesResult.success ? expensesResult.data : []
    };
}

async function getData(startDate, endDate, branch) {
    const params = [startDate, endDate, branch || null];

    try {
        const mapping = await dbConfig.getCurrentMapping();
        const [mainResult, monthlyResult, manualData] = await Promise.all([
            db.query(queries.processQuery(queries.mainQuery, mapping), params),
            db.query(queries.processQuery(queries.monthlyQuery, mapping), params),
            getManualData(startDate, endDate, branch)
        ]);

        const main = mergeManualIntoMainRows(mainResult.rows, manualData.accounts, manualData.expenses);
        const monthly = mergeManualIntoMonthlyRows(monthlyResult.rows, manualData.expenses);
        const top10 = buildTop10FromMainRows(main);
        const manualTotal = manualData.expenses.reduce((sum, item) => sum + toNumber(item.amount), 0);
        const erpTotal = mainResult.rows.length ? toNumber(mainResult.rows[0].total_despesas) : 0;

        return {
            success: true,
            data: {
                main,
                monthly,
                top10,
                manualAccounts: manualData.accounts,
                manualExpenses: manualData.expenses,
                totals: {
                    erpExpense: erpTotal,
                    manualExpense: manualTotal,
                    consolidatedExpense: erpTotal + manualTotal
                }
            }
        };
    } catch (error) {
        console.error('Error executing queries:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

async function getBranches() {
    try {
        const mapping = await dbConfig.getCurrentMapping();
        const result = await db.query(queries.processQuery(queries.branchesQuery, mapping));
        return { success: true, data: result.rows };
    } catch (error) {
        console.error('Error fetching branches:', error);
        return { success: false, error: error.message };
    }
}

async function getAccountHistory(startDate, endDate, branch, accountId) {
    const params = [startDate, endDate, branch || null, accountId];
    try {
        const manualResult = await manualExpenseService.listExpenses({ startDate, endDate, branch, accountId });
        const manualRows = manualResult.success ? manualResult.data.map(mapManualHistory) : [];

        if (normalizeAccountId(accountId).startsWith('manual_acc')) {
            return {
                success: true,
                data: manualRows.sort((a, b) => String(b.datahora).localeCompare(String(a.datahora)))
            };
        }

        const mapping = await dbConfig.getCurrentMapping();
        const result = await db.query(queries.processQuery(queries.accountHistoryQuery, mapping), params);
        const erpRows = result.rows.map((row) => ({ ...row, origem: 'ERP' }));
        const data = [...erpRows, ...manualRows].sort((a, b) => new Date(b.datahora) - new Date(a.datahora));
        return { success: true, data };
    } catch (error) {
        console.error('Error fetching account history:', error);
        return { success: false, error: error.message };
    }
}

async function getBranchInfo() {
    try {
        const mapping = await dbConfig.getCurrentMapping();
        const result = await db.query(queries.processQuery(queries.branchInfoQuery, mapping));
        return { success: true, data: result.rows };
    } catch (error) {
        console.error('Error fetching branch info:', error);
        return { success: false, error: error.message };
    }
}

async function getAIContext(startDate, endDate, branch) {
    const params = [startDate, endDate, branch || null];

    try {
        const mapping = await dbConfig.getCurrentMapping();
        const [mainResult, monthlyResult, topTransResult, manualData] = await Promise.all([
            db.query(queries.processQuery(queries.mainQuery, mapping), params),
            db.query(queries.processQuery(queries.monthlyQuery, mapping), params),
            db.query(queries.processQuery(queries.topTransactionsContextQuery, mapping), params),
            getManualData(startDate, endDate, branch)
        ]);

        const mainRows = mergeManualIntoMainRows(mainResult.rows, manualData.accounts, manualData.expenses);
        const monthlyRows = mergeManualIntoMonthlyRows(monthlyResult.rows, manualData.expenses);
        const top10Rows = buildTop10FromMainRows(mainRows);
        const manualTotal = manualData.expenses.reduce((sum, item) => sum + toNumber(item.amount), 0);
        const erpTotal = mainResult.rows.length ? toNumber(mainResult.rows[0].total_despesas) : 0;
        const totalIncome = mainRows.length ? toNumber(mainRows[0].total_faturamento) : 0;
        const consolidatedTotal = erpTotal + manualTotal;

        const context = {
            period: { start: startDate, end: endDate },
            summary: {},
            topExpenses: [],
            montlyTrend: [],
            expenses: {
                erpTotal,
                manualTotal,
                consolidatedTotal,
                manualExpenses: manualData.expenses.map((expense) => ({
                    accountId: expense.accountId,
                    accountName: expense.accountName,
                    accountSource: expense.accountSource,
                    amount: toNumber(expense.amount),
                    date: expense.date,
                    branchId: expense.branchId,
                    branchName: expense.branchName,
                    entity: expense.entity,
                    document: expense.document,
                    history: expense.history,
                    observation: expense.observation,
                    source: 'manual'
                }))
            },
            manualAccounts: manualData.accounts,
            dataOrigins: {
                erp: 'Banco do ERP somente leitura',
                manual: 'electron-store local do app'
            }
        };

        context.summary = {
            total_income: totalIncome,
            total_expense: consolidatedTotal,
            erp_expense: erpTotal,
            manual_expense: manualTotal,
            net_result: totalIncome - consolidatedTotal
        };

        context.topExpenses = top10Rows.map(r => ({
            cat: r.conta,
            val: toNumber(r.total_despesa),
            source: r.account_source || 'erp'
        }));

        context.montlyTrend = monthlyRows.map(r => ({
            ym: `${r.ano}-${r.mes}`,
            inc: toNumber(r.total_faturamento_mes),
            exp: toNumber(r.total_despesa_mes)
        }));

        context.detailedTransactions = topTransResult.rows.map(r => ({
            dt: r.datahora.toISOString().split('T')[0],
            cat: r.categoria,
            who: r.forn_cliente || 'N/A',
            val: toNumber(r.valor),
            doc: r.documento || '',
            desc: r.historico,
            source: 'erp'
        })).concat(manualData.expenses.map((expense) => ({
            dt: expense.date,
            cat: expense.accountName,
            who: expense.entity || 'N/A',
            val: toNumber(expense.amount),
            doc: expense.document || '',
            desc: expense.history,
            source: 'manual'
        })));

        context.accountsIndex = mainRows.map(r => ({
            id: r.id_conta,
            name: r.conta,
            total: toNumber(r.total_despesa),
            source: r.account_source || 'erp',
            erpTotal: toNumber(r.erp_total_despesa),
            manualTotal: toNumber(r.manual_total_despesa)
        }));

        return { success: true, data: context };

    } catch (error) {
        console.error('Error building AI context:', error);
        return { success: false, error: error.message };
    }
}

async function getAccountDetails(startDate, endDate, branch, accountId) {
    const params = [startDate, endDate, branch || null, accountId];
    try {
        const manualResult = await manualExpenseService.listExpenses({ startDate, endDate, branch, accountId });
        const manualRows = manualResult.success ? manualResult.data.map((expense) => ({
            dt: expense.date,
            val: toNumber(expense.amount),
            who: expense.entity || 'N/A',
            doc: expense.document || '',
            desc: expense.history,
            observation: expense.observation || '',
            source: 'manual'
        })) : [];

        if (normalizeAccountId(accountId).startsWith('manual_acc')) {
            return {
                success: true,
                data: manualRows.sort((a, b) => String(b.dt).localeCompare(String(a.dt)))
            };
        }

        const mapping = await dbConfig.getCurrentMapping();
        const result = await db.query(queries.processQuery(queries.accountTransactionsQuery, mapping), params);
        const erpRows = result.rows.map(r => ({
            dt: r.datahora.toISOString().split('T')[0],
            val: toNumber(r.valor),
            who: r.forn_cliente || 'N/A',
            doc: r.documento || '',
            desc: r.historico,
            source: 'erp'
        }));

        return {
            success: true,
            data: [...erpRows, ...manualRows].sort((a, b) => String(b.dt).localeCompare(String(a.dt)))
        };
    } catch (error) {
        console.error('Error fetching account details for AI:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    getData,
    getBranches,
    getAccountHistory,
    getBranchInfo,
    getAIContext,
    getAccountDetails
};
