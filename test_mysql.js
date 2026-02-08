import mysql from 'mysql2/promise';

async function testConnection() {
  console.log('Testing connection to MySQL...');
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'nexia',
      database: 'nexiadicom'
    });
    console.log('Connection successful!');
    
    const [rows, fields] = await connection.execute('SELECT VERSION() as version');
    console.log('MySQL Version:', rows[0].version);
    
    await connection.end();
  } catch (err) {
    console.error('Connection failed:', err.message);
  }
}

testConnection();
