const path = require('path');

class SyncState {
    constructor() {
        this.store = null;
        this.initPromise = this.init();
    }

    async init() {
        try {
            const { default: Store } = await import('electron-store');
            this.store = new Store({
                name: 'sync-state',
                defaults: {
                    sync: {
                        branches: {},
                        global: {
                            firstRunCompleted: false
                        }
                    }
                }
            });
            console.log('[SyncState] Store initialized');
        } catch (error) {
            console.error('[SyncState] Failed to initialize store:', error);
            throw error;
        }
    }

    async ready() {
        await this.initPromise;
    }

    getBranchState(branchCode) {
        if (!this.store) return null;
        return this.store.get(`sync.branches.${branchCode}`, {
            lastSyncDate: null,
            status: 'pending',
            lastError: null
        });
    }

    setBranchSuccess(branchCode, date) {
        if (!this.store) return;
        this.store.set(`sync.branches.${branchCode}`, {
            lastSyncDate: date,
            status: 'success',
            lastError: null,
            lastSuccessAt: new Date().toISOString()
        });
    }

    setBranchError(branchCode, error) {
        if (!this.store) return;
        const current = this.getBranchState(branchCode);
        this.store.set(`sync.branches.${branchCode}`, {
            ...current,
            status: 'error',
            lastError: error,
            lastErrorAt: new Date().toISOString()
        });
    }

    isGlobalFirstRunDone() {
        if (!this.store) return false;
        return this.store.get('sync.global.firstRunCompleted');
    }

    setGlobalFirstRunDone() {
        if (!this.store) return;
        this.store.set('sync.global.firstRunCompleted', true);
    }

    reset() {
        if (!this.store) return;
        this.store.clear();
        console.log('[SyncState] Store reset');
    }
}

module.exports = new SyncState();
