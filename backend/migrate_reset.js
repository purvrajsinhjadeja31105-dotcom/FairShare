const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME
        });

        console.log("Checking users table...");
        const [columns] = await connection.query("SHOW COLUMNS FROM users LIKE 'reset_token'");
        if (columns.length === 0) {
            console.log("Adding reset_token and reset_token_expiry...");
            await connection.query('ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) DEFAULT NULL, ADD COLUMN reset_token_expiry DATETIME DEFAULT NULL');
            console.log("Migration complete!");
        } else {
            console.log("Columns already exist.");
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
migrate();
