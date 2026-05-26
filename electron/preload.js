const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getData: (params) => ipcRenderer.invoke('get-data', params),
    getBranches: () => ipcRenderer.invoke('get-branches'),
    getStockIntelligence: (params) => ipcRenderer.invoke('get-stock-intelligence', params),
    getStockFilterOptions: () => ipcRenderer.invoke('get-stock-filter-options'),
    getStockKpis: (params) => ipcRenderer.invoke('get-stock-kpis', params),
    getStockDrillDown: (productId, params) => ipcRenderer.invoke('get-stock-drilldown', { productId, params }),
    getStockMasterProducts: () => ipcRenderer.invoke('get-stock-master-products'),
    getStockImpact: (params) => ipcRenderer.invoke('get-stock-impact', params),
    getAccountHistory: (params) => ipcRenderer.invoke('get-account-history', params),
    listManualAccounts: () => ipcRenderer.invoke('manual-list-accounts'),
    createManualAccount: (payload) => ipcRenderer.invoke('manual-create-account', payload),
    updateManualAccount: (id, payload) => ipcRenderer.invoke('manual-update-account', { id, payload }),
    deleteManualAccount: (id) => ipcRenderer.invoke('manual-delete-account', id),
    listManualExpenses: (filters) => ipcRenderer.invoke('manual-list-expenses', filters),
    createManualExpense: (payload) => ipcRenderer.invoke('manual-create-expense', payload),
    updateManualExpense: (id, payload) => ipcRenderer.invoke('manual-update-expense', { id, payload }),
    deleteManualExpense: (id) => ipcRenderer.invoke('manual-delete-expense', id),
    askAI: (params) => ipcRenderer.invoke('ai-chat', params),
    getPresentationAnalysis: (params) => ipcRenderer.invoke('ai-presentation', params),
    onAIStreamChunk: (callback) => ipcRenderer.on('ai-stream-chunk', callback),
    removeAIStreamListeners: () => ipcRenderer.removeAllListeners('ai-stream-chunk'),
    
    // Database Config
    dbGetSupportedTypes: () => ipcRenderer.invoke('db-get-supported-types'),
    dbListConnections: () => ipcRenderer.invoke('db-list-connections'),
    dbUpsertConnection: (payload) => ipcRenderer.invoke('db-upsert-connection', payload),
    dbTestConnection: (payload) => ipcRenderer.invoke('db-test-connection', payload),
    dbDeleteConnection: (id) => ipcRenderer.invoke('db-delete-connection', id),
    dbSetActiveConnection: (id) => ipcRenderer.invoke('db-set-active-connection', id),
    dbGetSchema: (id) => ipcRenderer.invoke('db-get-schema', id),
    dbGetMappingTemplate: (id) => ipcRenderer.invoke('db-get-mapping-template', id),
    dbSaveMapping: (payload) => ipcRenderer.invoke('db-save-mapping', payload)
});
