const syncService = require('./services/sync/SyncService');

async function startSyncService() {
    // Delegate to the new modular service
    return syncService.start();
}

module.exports = { startSyncService };
