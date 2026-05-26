let Store;

const STORE_NAME = 'manual-expenses';
const ACCOUNT_KEY = 'manualChartAccounts';
const EXPENSE_KEY = 'manualExpenses';

class ManualExpenseService {
    constructor() {
        this.store = null;
    }

    async _getStore() {
        if (this.store) return this.store;

        if (!Store) {
            const { default: electronStore } = await import('electron-store');
            Store = electronStore;
        }

        this.store = new Store({
            name: STORE_NAME,
            projectName: 'despesas-x-faturamento',
            defaults: {
                [ACCOUNT_KEY]: [],
                [EXPENSE_KEY]: []
            }
        });

        return this.store;
    }

    _ok(data) {
        return { success: true, data };
    }

    _fail(error) {
        return { success: false, error: error?.message || String(error) };
    }

    _now() {
        return new Date().toISOString();
    }

    _id(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    _normalizeAmount(value) {
        if (typeof value === 'number') return value;
        const normalized = String(value || '')
            .replace(/\s/g, '')
            .replace(/\./g, '')
            .replace(',', '.');
        return Number(normalized);
    }

    _isActive(account) {
        return account.active !== false;
    }

    _isInRange(date, startDate, endDate) {
        if (!date) return false;
        if (startDate && date < startDate) return false;
        if (endDate && date > endDate) return false;
        return true;
    }

    _matchesBranch(expense, branch) {
        if (!branch) return true;
        return String(expense.branchId || '') === String(branch);
    }

    async listAccounts(options = {}) {
        try {
            const store = await this._getStore();
            let accounts = store.get(ACCOUNT_KEY, []);
            if (options.activeOnly !== false) {
                accounts = accounts.filter((account) => this._isActive(account));
            }
            return this._ok(accounts);
        } catch (error) {
            return this._fail(error);
        }
    }

    async createAccount(payload = {}) {
        try {
            const name = String(payload.name || '').trim();
            if (!name) throw new Error('Informe o nome da conta manual.');

            const store = await this._getStore();
            const accounts = store.get(ACCOUNT_KEY, []);
            const now = this._now();
            const nextNumber = accounts.length + 1;
            const account = {
                id: this._id('manual_acc'),
                name,
                code: String(payload.code || '').trim() || `MAN-${String(nextNumber).padStart(3, '0')}`,
                type: 'manual',
                category: String(payload.category || '').trim(),
                active: payload.active !== false,
                observation: String(payload.observation || '').trim(),
                createdAt: now,
                updatedAt: now
            };

            store.set(ACCOUNT_KEY, [...accounts, account]);
            return this._ok(account);
        } catch (error) {
            return this._fail(error);
        }
    }

    async updateAccount(id, payload = {}) {
        try {
            const store = await this._getStore();
            const accounts = store.get(ACCOUNT_KEY, []);
            const index = accounts.findIndex((account) => account.id === id);
            if (index < 0) throw new Error('Conta manual não encontrada.');

            const next = {
                ...accounts[index],
                name: payload.name !== undefined ? String(payload.name || '').trim() : accounts[index].name,
                code: payload.code !== undefined ? String(payload.code || '').trim() : accounts[index].code,
                category: payload.category !== undefined ? String(payload.category || '').trim() : accounts[index].category,
                active: payload.active !== undefined ? Boolean(payload.active) : accounts[index].active,
                observation: payload.observation !== undefined ? String(payload.observation || '').trim() : accounts[index].observation,
                updatedAt: this._now()
            };

            if (!next.name) throw new Error('Informe o nome da conta manual.');

            accounts[index] = next;
            store.set(ACCOUNT_KEY, accounts);
            return this._ok(next);
        } catch (error) {
            return this._fail(error);
        }
    }

    async deleteAccount(id) {
        return this.updateAccount(id, { active: false });
    }

    async listExpenses(filters = {}) {
        try {
            const store = await this._getStore();
            const expenses = store.get(EXPENSE_KEY, [])
                .filter((expense) => this._isInRange(expense.date, filters.startDate, filters.endDate))
                .filter((expense) => this._matchesBranch(expense, filters.branch))
                .filter((expense) => !filters.accountId || String(expense.accountId) === String(filters.accountId));

            return this._ok(expenses);
        } catch (error) {
            return this._fail(error);
        }
    }

    async createExpense(payload = {}) {
        try {
            const accountId = String(payload.accountId || '').trim();
            const accountName = String(payload.accountName || '').trim();
            const accountSource = payload.accountSource === 'erp' ? 'erp' : 'manual';
            const date = String(payload.date || '').slice(0, 10);
            const branchId = String(payload.branchId || '').trim();
            const amount = this._normalizeAmount(payload.amount);
            const history = String(payload.history || '').trim();

            if (!accountId || !accountName) throw new Error('Conta inválida para o lançamento.');
            if (!date) throw new Error('Informe a data da despesa.');
            if (!branchId) throw new Error('Informe a filial da despesa.');
            if (!Number.isFinite(amount) || amount <= 0) throw new Error('Informe um valor maior que zero.');
            if (!history) throw new Error('Informe o histórico da despesa.');

            const store = await this._getStore();
            const expenses = store.get(EXPENSE_KEY, []);
            const now = this._now();
            const expense = {
                id: this._id('manual_exp'),
                accountId,
                accountSource,
                accountName,
                date,
                branchId,
                branchName: String(payload.branchName || branchId).trim(),
                amount,
                document: String(payload.document || '').trim(),
                entity: String(payload.entity || '').trim(),
                history,
                observation: String(payload.observation || '').trim(),
                source: 'manual',
                createdAt: now,
                updatedAt: now
            };

            store.set(EXPENSE_KEY, [...expenses, expense]);
            return this._ok(expense);
        } catch (error) {
            return this._fail(error);
        }
    }

    async updateExpense(id, payload = {}) {
        try {
            const store = await this._getStore();
            const expenses = store.get(EXPENSE_KEY, []);
            const index = expenses.findIndex((expense) => expense.id === id);
            if (index < 0) throw new Error('Despesa manual não encontrada.');

            const amount = payload.amount !== undefined ? this._normalizeAmount(payload.amount) : expenses[index].amount;
            if (!Number.isFinite(amount) || amount <= 0) throw new Error('Informe um valor maior que zero.');

            const next = {
                ...expenses[index],
                ...payload,
                amount,
                date: payload.date ? String(payload.date).slice(0, 10) : expenses[index].date,
                updatedAt: this._now()
            };

            expenses[index] = next;
            store.set(EXPENSE_KEY, expenses);
            return this._ok(next);
        } catch (error) {
            return this._fail(error);
        }
    }

    async deleteExpense(id) {
        try {
            const store = await this._getStore();
            const expenses = store.get(EXPENSE_KEY, []);
            store.set(EXPENSE_KEY, expenses.filter((expense) => expense.id !== id));
            return this._ok({ id });
        } catch (error) {
            return this._fail(error);
        }
    }
}

module.exports = new ManualExpenseService();
