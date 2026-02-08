
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const dbConfig = {
  host: process.env.CONQUEST_DB_HOST || 'localhost',
  user: process.env.CONQUEST_DB_USER || 'root',
  password: process.env.CONQUEST_DB_PASSWORD || 'nexia',
  database: process.env.CONQUEST_DB_NAME || 'nexia'
};

async function check() {
  try {
    const conn = await mysql.createConnection(dbConfig);
    console.log("Connected to DB");
    
    const [studies] = await conn.query('SELECT * FROM dicomstudies LIMIT 1');
    console.log("Studies:", studies);

    const [images] = await conn.query('SELECT * FROM dicomimages LIMIT 1');
    console.log("Images:", images);
    
    await conn.end();
  } catch (e) {
    console.error(e);
  }
}
check();
