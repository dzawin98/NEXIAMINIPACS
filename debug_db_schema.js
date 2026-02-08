import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.CONQUEST_DB_HOST || 'localhost',
  user: process.env.CONQUEST_DB_USER || 'root',
  password: process.env.CONQUEST_DB_PASSWORD || 'nexia',
  database: process.env.CONQUEST_DB_NAME || 'nexia'
};

async function describeTables() {
    const pool = mysql.createPool(dbConfig);
    const tables = ['dicompatients', 'dicomstudies', 'dicomseries', 'dicomimages', 'submissions', 'uidmods'];

    console.log(`Connected to database: ${dbConfig.database}`);

    try {
        for (const table of tables) {
            console.log(`\n--- Schema for table: ${table} ---`);
            try {
                const [rows] = await pool.query(`DESCRIBE ${table}`);
                // Format output nicely
                console.table(rows.map(r => ({
                    Field: r.Field,
                    Type: r.Type,
                    Null: r.Null,
                    Key: r.Key,
                    Default: r.Default
                })));
            } catch (err) {
                console.error(`Error describing table ${table}:`, err.message);
            }
        }
    } catch (err) {
        console.error("Database connection error:", err);
    } finally {
        await pool.end();
    }
}

describeTables();
