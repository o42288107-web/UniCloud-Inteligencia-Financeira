const service = require('./backend/service');
const syncApi = require('./backend/services/sync/SyncAPI');
require('dotenv').config();

async function testFetch() {
    console.log('--- Test API Fetch ---');
    
    // 1. Get a Branch
    const branchesResult = await service.getBranchInfo();
    if (!branchesResult.success || branchesResult.data.length === 0) {
        console.error('No branches found.');
        return;
    }

    const branch = branchesResult.data[0];
    console.log(`Using Branch: ${branch.codigo} - ${branch.nome}`);

    try {
        // 2. Authenticate
        console.log('Authenticating...');
        const auth = await syncApi.authenticate(branch);
        console.log('Auth Success. Tenant:', auth.tenantId);

        // 3. Fetch Data
        console.log('Fetching Dashboard Data from API...');
        const data = await syncApi.fetchRemoteData(auth.token, auth.tenantId, 'dashboard');

        if (data) {
            console.log('Data Received!');
            
            if (data.meta) {
                console.log('Meta:', data.meta);
            }
            
            if (data.data) {
                console.log('Data Keys:', Object.keys(data.data));
                if (data.data.main) {
                    console.log('Main Records:', data.data.main.length);
                }
            } else {
                console.log('Raw Data:', typeof data === 'object' ? Object.keys(data) : data);
            }

        } else {
            console.warn('No data received (empty response).');
        }

    } catch (error) {
        console.error('Test Failed:', error.message);
    }
}

testFetch();
