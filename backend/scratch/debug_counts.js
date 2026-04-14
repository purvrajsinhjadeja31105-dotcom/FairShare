const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME
    });

    try {
        const [groups] = await connection.query(`
            SELECT eg.id, eg.name, 
            (SELECT COUNT(*) FROM group_members WHERE group_id = eg.id) as member_count
            FROM expense_groups eg
        `);
        console.log("Groups and counts:", JSON.stringify(groups, null, 2));

        const [members] = await connection.query("SELECT * FROM group_members");
        console.log("All group_members entries:", JSON.stringify(members, null, 2));
        
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

check();
