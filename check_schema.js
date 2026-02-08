
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const dbConfig = {
  host: process.env.CONQUEST_DB_HOST || 'localhost',
  user: process.env.CONQUEST_DB_USER || 'root',
  password: process.env.CONQUEST_DB_PASSWORD || 'nexia',
  database: process.env.CONQUEST_DB_NAME || 'nexia'
};

async function checkSchema() {
  const pool = mysql.createPool(dbConfig);
  try {
    const [rows] = await pool.query('DESCRIBE dicomstudies');
    console.log('dicomstudies columns:', rows.map(r => r.Field));
    
    const [rows2] = await pool.query('DESCRIBE dicomseries');
    console.log('dicomseries columns:', rows2.map(r => r.Field));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkSchema();
