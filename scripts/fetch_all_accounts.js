const db = require('../backend/db');

async function main() {
    try {
        const res = await db.query(`
            SELECT nome 
            FROM planocontas 
            WHERE tipoconta = 1 
            AND nome <> 'Transferência Conta Saída'
            ORDER BY nome
        `);

        const fs = require('fs');
        const names = res.rows.map(r => r.nome.trim());
        fs.writeFileSync('scripts/account_list.txt', JSON.stringify(names, null, 2));
        console.log("Details written to scripts/account_list.txt");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();
