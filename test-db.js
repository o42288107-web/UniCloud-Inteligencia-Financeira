const db = require('./backend/db');

async function testConnection() {
    console.log('Testing DB connection...');
    try {
        const res = await db.query('SELECT NOW()');
        console.log('Connection successful:', res.rows[0]);
    } catch (err) {
        console.error('Connection failed:', err);
    } finally {
        process.exit();
    }
}

testConnection();
