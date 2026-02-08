
import mysql from 'mysql2/promise';

const password = 'nexia';
const user = 'root';
const host = 'localhost';
const database = 'nexia';

async function listColumns() {
  try {
    const connection = await mysql.createConnection({
      host,
      user,
      password,
      database
    });
    
    const [rows] = await connection.query('DESCRIBE dicomimages');
    console.log('Columns in dicomimages:');
    rows.forEach(r => console.log(r.Field));
    
    await connection.end();
  } catch (err) {
    console.log(`Error: ${err.message}`);
  }
}

listColumns();
