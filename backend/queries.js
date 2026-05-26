module.exports = {
    // 1. Mandatory Main Query (Detailed List with Ratios)
    mainQuery: `
        SELECT
            d.id_conta,
            d.conta,
            d.total_despesa,
            t.total_despesas,
            f.total_faturamento,
            CAST(d.total_despesa / NULLIF(t.total_despesas, 0) AS NUMERIC) AS frac_sobre_desp_total,
            CAST(d.total_despesa / NULLIF(f.total_faturamento, 0) AS NUMERIC) AS frac_sobre_faturamento,
            CAST(d.total_despesa / NULLIF(t.total_despesas, 0) * 100 AS NUMERIC) AS perc_sobre_desp_total,
            CAST(d.total_despesa / NULLIF(f.total_faturamento, 0) * 100 AS NUMERIC) AS perc_sobre_faturamento
        FROM (
            SELECT
                pc.id AS id_conta,
                pc.nome AS conta,
                SUM(ABS(ccl.{{DESP_VAL}})) AS total_despesa,
                SUM(ccl.{{DESP_VAL}} * -1) AS total_despesa_ord
            FROM {{DESP_TABLE}} ccl
            JOIN planocontas pc ON pc.id = ccl.{{DESP_ACCOUNT}}
            LEFT JOIN filial fi ON fi.id = ccl.{{DESP_BRANCH}}
            WHERE CAST(ccl.{{DESP_DATE}} AS DATE) BETWEEN $1 AND $2
            AND pc.tipoconta = {{DESP_TYPE}}
            AND pc.nome <> 'Transferência Conta Saída'
            AND ( $3::text IS NULL OR $3::text = '' OR fi.codigo = $3::text )
            GROUP BY
                pc.id,
                pc.nome
        ) d
        CROSS JOIN (
            SELECT
                SUM(ABS(ccl.{{DESP_VAL}})) AS total_despesas
            FROM {{DESP_TABLE}} ccl
            JOIN planocontas pc ON pc.id = ccl.{{DESP_ACCOUNT}}
            LEFT JOIN filial fi ON fi.id = ccl.{{DESP_BRANCH}}
            WHERE CAST(ccl.{{DESP_DATE}} AS DATE) BETWEEN $1 AND $2
            AND pc.tipoconta = {{DESP_TYPE}}
            AND pc.nome <> 'Transferência Conta Saída'
            AND ( $3::text IS NULL OR $3::text = '' OR fi.codigo = $3::text )
        ) t
        CROSS JOIN (
            SELECT
                SUM(v.{{FAT_VAL}}) AS total_faturamento
            FROM {{FAT_TABLE}} v
            WHERE CAST(v.{{FAT_DATE}} AS DATE) BETWEEN $1 AND $2
            AND (v.status IS NULL OR v.status <> 0)
            AND ( $3::text IS NULL OR $3::text = '' OR v.{{FAT_BRANCH}} = $3::text )
        ) f
        ORDER BY d.total_despesa_ord DESC
    `,

    // 2. Monthly Evolution
    monthlyQuery: `
        SELECT 
            d.ano, 
            d.mes, 
            d.total_despesa_mes, 
            COALESCE(f.total_faturamento_mes, 0) AS total_faturamento_mes, 
            CASE 
                WHEN COALESCE(f.total_faturamento_mes, 0) = 0 THEN 0 
                ELSE (d.total_despesa_mes / COALESCE(f.total_faturamento_mes, 0)) * 100 
            END AS perc_desp_fat_mes 
        FROM (
            SELECT 
                CAST(EXTRACT(YEAR FROM ccl.{{DESP_DATE}}) AS INTEGER) AS ano, 
                CAST(EXTRACT(MONTH FROM ccl.{{DESP_DATE}}) AS INTEGER) AS mes, 
                SUM(ABS(ccl.{{DESP_VAL}})) AS total_despesa_mes 
            FROM {{DESP_TABLE}} ccl 
            JOIN planocontas pc ON pc.id = ccl.{{DESP_ACCOUNT}} 
            LEFT JOIN filial fi ON fi.id = ccl.{{DESP_BRANCH}}
            WHERE CAST(ccl.{{DESP_DATE}} AS DATE) BETWEEN $1 AND $2 
            AND pc.tipoconta = {{DESP_TYPE}} 
            AND pc.nome <> 'Transferência Conta Saída'
            AND ( $3::text IS NULL OR $3::text = '' OR fi.codigo = $3::text )
            GROUP BY EXTRACT(YEAR FROM ccl.{{DESP_DATE}}), EXTRACT(MONTH FROM ccl.{{DESP_DATE}})
        ) d 
        LEFT JOIN (
            SELECT 
                CAST(EXTRACT(YEAR FROM v.{{FAT_DATE}}) AS INTEGER) AS ano, 
                CAST(EXTRACT(MONTH FROM v.{{FAT_DATE}}) AS INTEGER) AS mes, 
                SUM(v.{{FAT_VAL}}) AS total_faturamento_mes 
            FROM {{FAT_TABLE}} v 
            WHERE CAST(v.{{FAT_DATE}} AS DATE) BETWEEN $1 AND $2 
            AND (v.status IS NULL OR v.status <> 0) 
            AND ( $3::text IS NULL OR $3::text = '' OR v.{{FAT_BRANCH}} = $3::text )
            GROUP BY EXTRACT(YEAR FROM v.{{FAT_DATE}}), EXTRACT(MONTH FROM v.{{FAT_DATE}})
        ) f ON f.ano = d.ano AND f.mes = d.mes 
        ORDER BY d.ano, d.mes
    `,

    // 3. Top 10 Expenses
    top10Query: `
        SELECT 
            pc.nome AS conta, 
            SUM(ABS(ccl.{{DESP_VAL}})) AS total_despesa 
        FROM {{DESP_TABLE}} ccl 
        JOIN planocontas pc ON pc.id = ccl.{{DESP_ACCOUNT}} 
        LEFT JOIN filial fi ON fi.id = ccl.{{DESP_BRANCH}}
        WHERE CAST(ccl.{{DESP_DATE}} AS DATE) BETWEEN $1 AND $2 
        AND pc.tipoconta = {{DESP_TYPE}} 
        AND pc.nome <> 'Transferência Conta Saída'
        AND ( $3::text IS NULL OR $3::text = '' OR fi.codigo = $3::text )
        GROUP BY pc.nome 
        ORDER BY total_despesa DESC 
        LIMIT 10
    `,

    // 4. Branches List
    branchesQuery: `
        SELECT
            fi.codigo AS value,
            CAST(fi.codigo AS TEXT) || ' - ' || fi.nome AS label
        FROM filial fi
        ORDER BY fi.codigo
    `,

    // 5. Account History
    accountHistoryQuery: `
        SELECT
            ccl.{{DESP_DATE}} as datahora,
            ccl.historico,
            ccl.documento,
            x.forn_cliente,
            ccl.{{DESP_VAL}} as valor
        FROM {{DESP_TABLE}} ccl
        LEFT JOIN filial fi ON fi.id = ccl.{{DESP_BRANCH}}
        LEFT JOIN (
            SELECT
                efd.idcontacorrentelancamento,
                COALESCE(MAX(e.nome), MAX(ee.nome)) AS forn_cliente
            FROM eventofinanceirodestino efd
            LEFT JOIN financeirolancamento fl ON fl.id = efd.idfinanceirolancamento
            LEFT JOIN financeiro f ON f.id = fl.idfinanceiro
            LEFT JOIN entidade e ON e.id = f.identidade
            LEFT JOIN eventofinanceiro ef ON ef.id = efd.ideventofinanceiro
            LEFT JOIN entidade ee ON ee.id = ef.identidade
            GROUP BY efd.idcontacorrentelancamento
        ) x ON x.idcontacorrentelancamento = ccl.id
        WHERE CAST(ccl.{{DESP_DATE}} AS DATE) BETWEEN $1 AND $2
        AND ccl.{{DESP_ACCOUNT}} = $4
        AND ( $3::text IS NULL OR $3::text = '' OR fi.codigo = $3::text )
        ORDER BY ccl.{{DESP_DATE}} DESC
    `,

    // 6. Branch Info
    branchInfoQuery: `
        SELECT codigo, nome, cnpj FROM filial ORDER BY codigo
    `,

    // 7. Top Transactions for AI Context
    topTransactionsContextQuery: `
        SELECT
            ccl.{{DESP_DATE}} as datahora,
            ccl.historico,
            pc.nome as categoria,
            x.forn_cliente,
            ccl.{{DESP_VAL}} as valor
        FROM {{DESP_TABLE}} ccl
        JOIN planocontas pc ON pc.id = ccl.{{DESP_ACCOUNT}}
        LEFT JOIN filial fi ON fi.id = ccl.{{DESP_BRANCH}}
        LEFT JOIN (
            SELECT
                efd.idcontacorrentelancamento,
                COALESCE(MAX(e.nome), MAX(ee.nome)) AS forn_cliente
            FROM eventofinanceirodestino efd
            LEFT JOIN financeirolancamento fl ON fl.id = efd.idfinanceirolancamento
            LEFT JOIN financeiro f ON f.id = fl.idfinanceiro
            LEFT JOIN entidade e ON e.id = f.identidade
            LEFT JOIN eventofinanceiro ef ON ef.id = efd.ideventofinanceiro
            LEFT JOIN entidade ee ON ee.id = ef.identidade
            GROUP BY efd.idcontacorrentelancamento
        ) x ON x.idcontacorrentelancamento = ccl.id
        WHERE CAST(ccl.{{DESP_DATE}} AS DATE) BETWEEN $1 AND $2
        AND pc.tipoconta = {{DESP_TYPE}}
        AND pc.nome <> 'Transferência Conta Saída'
        AND ( $3::text IS NULL OR $3::text = '' OR fi.codigo = $3::text )
        ORDER BY ABS(ccl.{{DESP_VAL}}) DESC
        LIMIT 150
    `,

    // 8. Accounts Index
    accountsIndexQuery: `
        SELECT
            pc.id,
            pc.nome,
            SUM(ABS(ccl.{{DESP_VAL}})) as total_periodo
        FROM {{DESP_TABLE}} ccl
        JOIN planocontas pc ON pc.id = ccl.{{DESP_ACCOUNT}}
        LEFT JOIN filial fi ON fi.id = ccl.{{DESP_BRANCH}}
        WHERE CAST(ccl.{{DESP_DATE}} AS DATE) BETWEEN $1 AND $2
        AND pc.tipoconta = {{DESP_TYPE}}
        AND pc.nome <> 'Transferência Conta Saída'
        AND ( $3::text IS NULL OR $3::text = '' OR fi.codigo = $3::text )
        GROUP BY pc.id, pc.nome
        ORDER BY total_periodo DESC
    `,

    // 9. Full History for AI
    accountTransactionsQuery: `
        SELECT
            ccl.{{DESP_DATE}} as datahora,
            ccl.historico,
            ccl.documento,
            x.forn_cliente,
            ccl.{{DESP_VAL}} as valor
        FROM {{DESP_TABLE}} ccl
        LEFT JOIN filial fi ON fi.id = ccl.{{DESP_BRANCH}}
        LEFT JOIN (
            SELECT
                efd.idcontacorrentelancamento,
                COALESCE(MAX(e.nome), MAX(ee.nome)) AS forn_cliente
            FROM eventofinanceirodestino efd
            LEFT JOIN financeirolancamento fl ON fl.id = efd.idfinanceirolancamento
            LEFT JOIN financeiro f ON f.id = fl.idfinanceiro
            LEFT JOIN entidade e ON e.id = f.identidade
            LEFT JOIN eventofinanceiro ef ON ef.id = efd.ideventofinanceiro
            LEFT JOIN entidade ee ON ee.id = ef.identidade
            GROUP BY efd.idcontacorrentelancamento
        ) x ON x.idcontacorrentelancamento = ccl.id
        WHERE CAST(ccl.{{DESP_DATE}} AS DATE) BETWEEN $1 AND $2
        AND ccl.{{DESP_ACCOUNT}} = $4
        AND ( $3::text IS NULL OR $3::text = '' OR fi.codigo = $3::text )
        ORDER BY ccl.{{DESP_DATE}} DESC
        LIMIT 2000
    `,

    processQuery: (query, mapping) => {
        // Default fallbacks (Pratika/Uniplus standard)
        const m = {
            fat_table: mapping?.faturamento?.table || 'vendas_cabecalho_view',
            fat_val: mapping?.faturamento?.valueCol || 'valortotal',
            fat_date: mapping?.faturamento?.dateCol || 'emissao',
            fat_branch: mapping?.faturamento?.branchCol || 'filial',
            desp_table: mapping?.despesas?.table || 'contacorrentelancamento',
            desp_val: mapping?.despesas?.valueCol || 'valor',
            desp_date: mapping?.despesas?.dateCol || 'datahora',
            desp_branch: mapping?.despesas?.branchCol || 'idfilial',
            desp_account: mapping?.despesas?.accountCol || 'idplanocontas',
            desp_account_name: mapping?.despesas?.accountNameCol || 'conta',
            desp_type: mapping?.despesas?.expenseType || '1'
        };

        return query
            .replace(/{{FAT_TABLE}}/g, m.fat_table)
            .replace(/{{FAT_VAL}}/g, m.fat_val)
            .replace(/{{FAT_DATE}}/g, m.fat_date)
            .replace(/{{FAT_BRANCH}}/g, m.fat_branch)
            .replace(/{{DESP_TABLE}}/g, m.desp_table)
            .replace(/{{DESP_VAL}}/g, m.desp_val)
            .replace(/{{DESP_DATE}}/g, m.desp_date)
            .replace(/{{DESP_BRANCH}}/g, m.desp_branch)
            .replace(/{{DESP_ACCOUNT}}/g, m.desp_account)
            .replace(/{{DESP_ACCOUNT_NAME}}/g, m.desp_account_name)
            .replace(/{{DESP_TYPE}}/g, m.desp_type);
    }
};
