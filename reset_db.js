import mysql from 'mysql2/promise';

async function resetDatabase() {
  console.log('Resetting database nexiadicom...');
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'nexia'
    });
    
    await connection.query('DROP DATABASE IF EXISTS nexiadicom');
    await connection.query('CREATE DATABASE nexiadicom CHARACTER SET utf8 COLLATE utf8_general_ci');
    
    console.log('Database nexiadicom recreated with utf8.');
    await connection.end();
  } catch (err) {
    console.error('Failed:', err.message);
  }
}

resetDatabase();
