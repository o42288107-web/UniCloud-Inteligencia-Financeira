const service = require('../../service');
const syncState = require('./SyncState');
const syncApi = require('./SyncAPI');
require('dotenv').config();

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const FULL_SYNC_START_DATE = '2020-01-01';

class SyncService {
    constructor() {
        this.isRunning = false;
        this.timer = null;
    }

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;

        console.log('[SyncService] Starting service...');

        // Wait for store to be ready
        await syncState.ready();

        if (process.env.RESET_SYNC === 'true') {
            syncState.reset();
            console.log('[SyncService] RESET_SYNC detected: State cleared.');
        }

        // Run immediately
        this.runCycle();

        // Schedule periodic
        this.timer = setInterval(() => this.runCycle(), SYNC_INTERVAL_MS);
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
        this.isRunning = false;
        console.log('[SyncService] Service stopped.');
    }

    async runCycle() {
        console.log('[SyncService] Starting sync cycle...');
        
        try {
            // 1. Get Configuration & Branches
            console.log('[SyncService] Fetching branch info from DB...');
            const branchesResult = await service.getBranchInfo();
            
            if (!branchesResult.success) {
                console.error('[SyncService] Failed to fetch branches:', branchesResult.error);
                return;
            }

            const branches = branchesResult.data;
            console.log(`[SyncService] Found ${branches.length} branches.`);

            // Sort to ensure consistent order (Branch 1 first usually)
            branches.sort((a, b) => a.codigo - b.codigo);

            let successCount = 0;

            for (const branch of branches) {
                const success = await this.processBranch(branch);
                if (success) successCount++;
            }

            console.log(`[SyncService] Cycle completed. Success: ${successCount}/${branches.length}`);

        } catch (error) {
            console.error('[SyncService] Fatal error in cycle:', error);
        }
    }

    async processBranch(branch) {
        const { codigo, nome } = branch;
        // console.log(`[SyncService] Processing Branch ${codigo} (${nome})...`);

        try {
            // 1. Determine Date Range
            const branchState = syncState.getBranchState(codigo);
            const endDate = new Date().toISOString().split('T')[0];
            let startDate;
            let syncType = 'INCREMENTAL';

            // Logic: If never synced OR last status was error (optional strategy), do FULL or recover.
            // Simplified: If no lastSyncDate, FULL. Else, First day of current month (Incremental).
            
            if (!branchState.lastSyncDate) {
                startDate = FULL_SYNC_START_DATE;
                syncType = 'FULL';
            } else {
                // Incremental: Sync from start of current month to ensure updates in current period are captured
                const today = new Date();
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                startDate = firstDay.toISOString().split('T')[0];
            }

            // console.log(`[SyncService] Branch ${codigo} mode: ${syncType} (${startDate} to ${endDate})`);

            // 2. Fetch Data (Local DB)
            const dataResult = await service.getData(startDate, endDate, codigo);
            if (!dataResult.success) {
                throw new Error(`DB Fetch failed: ${dataResult.error}`);
            }

            // 3. Authenticate (Remote API)
            const auth = await syncApi.authenticate(branch);
            
            // 4. Send Data
            const meta = {
                branch_id: codigo,
                branch_name: nome,
                start_date: startDate,
                end_date: endDate,
                sync_type: syncType
            };

            await syncApi.sendData(auth.token, auth.tenantId, meta, dataResult.data);

            // 5. Update State
            syncState.setBranchSuccess(codigo, endDate);
            console.log(`[SyncService] Branch ${codigo} synced successfully.`);
            return true;

        } catch (error) {
            console.error(`[SyncService] Branch ${codigo} failed:`, error.message);
            syncState.setBranchError(codigo, error.message);
            return false;
        }
    }
}

module.exports = new SyncService();
