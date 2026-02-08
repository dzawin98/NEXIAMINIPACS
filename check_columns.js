
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.CONQUEST_DB_HOST || 'localhost',
  user: process.env.CONQUEST_DB_USER || 'root',
  password: process.env.CONQUEST_DB_PASSWORD || 'nexia',
  database: process.env.CONQUEST_DB_NAME || 'nexia'
};

async function checkColumns() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.query('DESCRIBE dicomimages');
    console.log('Columns in dicomimages:');
    rows.forEach(row => console.log(row.Field));
    await connection.end();
  } catch (err) {
    console.error(err);
  }
}

checkColumns();
