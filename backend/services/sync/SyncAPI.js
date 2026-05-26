const axios = require('axios');
const util = require('util');
const zlib = require('zlib');
const gzip = util.promisify(zlib.gzip);
require('dotenv').config();

class SyncAPI {
    constructor() {
        this.baseUrl = process.env.API_BASE_URL;
        if (!this.baseUrl) {
            console.warn('[SyncAPI] Warning: API_BASE_URL is not set in .env');
        }
    }

    async authenticate(branch) {
        try {
            const payload = {
                cnpj: branch.cnpj,
                company_name: branch.nome,
                filial_id: branch.codigo
            };

            const url = `${this.baseUrl}/auth_agent.php`;
            // console.log(`[SyncAPI] Authenticating branch ${branch.codigo} at ${url}...`);

            const response = await axios.post(url, payload, { timeout: 10000 });

            if (!response.data || !response.data.token) {
                throw new Error('No token received from auth endpoint');
            }

            return {
                token: response.data.token,
                tenantId: response.data.tenant_id
            };
        } catch (error) {
            this._handleError(error, `Auth failed for branch ${branch.codigo}`);
            throw error;
        }
    }

    async sendData(token, tenantId, meta, data) {
        try {
            const url = `${this.baseUrl}/receive.php`;
            
            // 1. Prepare Payload
            const payload = JSON.stringify({
                tenant_id: tenantId,
                type: 'dashboard',
                meta: meta,
                data: data
            });

            // 2. Compress
            const compressed = await gzip(payload);

            // 3. Send
            const response = await axios.post(url, compressed, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Tenant-ID': tenantId,
                    'Content-Type': 'application/json',
                    'Content-Encoding': 'gzip'
                },
                timeout: 60000 // 1 minute upload timeout
            });

            if (response.status !== 200) {
                throw new Error(`Server responded with status ${response.status}`);
            }

            return response.data;

        } catch (error) {
            this._handleError(error, 'Send data failed');
            throw error;
        }
    }

    async fetchRemoteData(token, tenantId, type = 'dashboard') {
        try {
            const url = `${this.baseUrl}/get_data.php?tenant_id=${tenantId}&type=${type}`;
            
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Tenant-ID': tenantId
                },
                timeout: 30000
            });

            return response.data;
        } catch (error) {
            this._handleError(error, 'Fetch data failed');
            throw error;
        }
    }

    _handleError(error, context) {
        const msg = error.response 
            ? `Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`
            : error.message;
        console.error(`[SyncAPI] ${context}: ${msg}`);
    }
}

module.exports = new SyncAPI();
