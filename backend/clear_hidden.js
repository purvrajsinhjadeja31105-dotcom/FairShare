const mysql = require('mysql2/promise');
require('dotenv').config();

async function clearHidden() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME
        });

        console.log("Connected to database. Clearing hidden activities...");
        
        const [result] = await connection.query('DELETE FROM user_hidden_activities');
        console.log(`- Cleared ${result.affectedRows} entries from user_hidden_activities.`);

        console.log("All hidden activities have been restored for all users.");
        process.exit(0);
    } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') {
            console.log("- user_hidden_activities table does not exist or has already been dropped.");
        } else {
            console.error("Error clearing hidden activities:", err);
        }
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

clearHidden();
