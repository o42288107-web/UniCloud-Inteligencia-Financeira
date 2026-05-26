const { Pool } = require('pg');
const dbConfig = require('./db_config_service');
require('dotenv').config();

let pool = null;

async function getPool() {
    if (pool) return pool;

    let config = {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'unico',
        password: process.env.DB_PASSWORD || 'postgres',
        port: process.env.DB_PORT || 5432,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 10000,
    };

    try {
        const result = await dbConfig.listConnections();
        if (result && result.success && result.data) {
            const { connections, activeConnectionId } = result.data;
            if (Array.isArray(connections)) {
                const activeConn = connections.find(c => c.id === activeConnectionId);
                if (activeConn) {
                    config = {
                        user: activeConn.user,
                        host: activeConn.host,
                        database: activeConn.database,
                        password: activeConn.password,
                        port: activeConn.port,
                        ssl: activeConn.ssl ? { rejectUnauthorized: false } : false,
                        connectionTimeoutMillis: 5000,
                        idleTimeoutMillis: 10000,
                    };
                }
            }
        }
    } catch (err) {
        console.error('[DB] Error loading config from store, falling back to .env:', err.message);
    }

    pool = new Pool(config);
    return pool;
}

module.exports = {
    query: async (text, params) => {
        const p = await getPool();
        return p.query(text, params);
    },
    resetPool: () => {
        if (pool) {
            pool.end();
            pool = null;
        }
    }
};
