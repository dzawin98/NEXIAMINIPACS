
import mysql from 'mysql2/promise';

const password = 'nexia';
const user = 'root';
const host = 'localhost';
const database = 'nexia';

async function checkPath() {
  try {
    const connection = await mysql.createConnection({
      host,
      user,
      password,
      database
    });
    
    const [rows] = await connection.query('SELECT ObjectFile, DeviceName FROM dicomimages LIMIT 1');
    if (rows.length > 0) {
      console.log('Sample ObjectFile:', rows[0].ObjectFile);
      console.log('Sample DeviceName:', rows[0].DeviceName);
    } else {
      console.log('No images found.');
    }
    
    await connection.end();
  } catch (err) {
    console.log(`Error: ${err.message}`);
  }
}

checkPath();
