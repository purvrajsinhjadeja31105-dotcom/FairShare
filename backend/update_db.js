const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateDB() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME
        });

        console.log("Connected to database. Applying updates...");

        // 1. Add admin_id to expense_groups
        try {
            await connection.query('ALTER TABLE expense_groups ADD COLUMN admin_id INT NULL');
            await connection.query('ALTER TABLE expense_groups ADD FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL');
            console.log("- Added admin_id to expense_groups");
        } catch (err) {
            if (err.code === 'ER_DUP_COLUMN_NAME' || err.code === 'ER_DUP_FIELDNAME') {
                console.log("- admin_id already exists in expense_groups");
            } else {
                throw err;
            }
        }

        // 2. Add is_wrong to expenses
        try {
            await connection.query('ALTER TABLE expenses ADD COLUMN is_wrong BOOLEAN DEFAULT FALSE');
            console.log("- Added is_wrong to expenses");
        } catch (err) {
            if (err.code === 'ER_DUP_COLUMN_NAME' || err.code === 'ER_DUP_FIELDNAME') {
                console.log("- is_wrong already exists in expenses");
            } else {
                throw err;
            }
        }

        // 3. Create group_admin_polls table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS group_admin_polls (
                id INT AUTO_INCREMENT PRIMARY KEY,
                group_id INT NOT NULL,
                started_by INT NOT NULL,
                status ENUM('active', 'completed', 'expired') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (group_id) REFERENCES expense_groups(id) ON DELETE CASCADE,
                FOREIGN KEY (started_by) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log("- Created group_admin_polls table");

        // 4. Create poll_votes table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS poll_votes (
                poll_id INT NOT NULL,
                voter_id INT NOT NULL,
                candidate_id INT NOT NULL,
                voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (poll_id, voter_id),
                FOREIGN KEY (poll_id) REFERENCES group_admin_polls(id) ON DELETE CASCADE,
                FOREIGN KEY (voter_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (candidate_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log("- Created poll_votes table");

        // 5. Create user_hidden_activities table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS user_hidden_activities (
                user_id INT NOT NULL,
                expense_id INT NOT NULL,
                hidden_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, expense_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
            )
        `);
        console.log("- Created user_hidden_activities table");

        console.log("Database updates applied successfully.");
        process.exit(0);
    } catch (err) {
        console.error("Error updating database:", err);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

updateDB();
