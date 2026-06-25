const mysql = require('mysql2/promise');
require('dotenv').config();

async function listUsers() {
    let connection;
    try {
        const connectionConfig = {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
            ssl: { rejectUnauthorized: false }
        };

        connection = await mysql.createConnection(connectionConfig);
        const [rows] = await connection.query("SELECT id, username, email, is_verified, created_at FROM users ORDER BY created_at DESC");
        
        console.log(`\nSUCCESS: Found ${rows.length} user(s) in the database.\n`);
        if (rows.length > 0) {
            console.table(rows.map(row => ({
                ID: row.id,
                Username: row.username,
                Email: row.email,
                'Verified?': row.is_verified ? 'Yes' : 'No',
                'Signed Up At': row.created_at
            })));
        } else {
            console.log("No users registered yet.");
        }
    } catch (err) {
        console.error("\nERROR connecting to or querying the database:");
        console.error(err.message);
    } finally {
        if (connection) {
            await connection.end();
        }
        process.exit(0);
    }
}

listUsers();
