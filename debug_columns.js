
import mysql from 'mysql2/promise';

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'nexia',
  database: 'nexia' // Assuming nexia based on .env
};

async function check() {
    try {
        const conn = await mysql.createConnection(dbConfig);
        const [columns] = await conn.query('SHOW COLUMNS FROM dicomimages');
        console.log('Columns in dicomimages:', columns.map(c => c.Field));
        await conn.end();
    } catch (e) {
        console.error(e);
    }
}

check();
