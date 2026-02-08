import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

async function initDb() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Create database
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'minipacs'}`);
    console.log(`Database ${process.env.DB_NAME || 'minipacs'} created or exists.`);
    
    // Switch to database
    await connection.changeUser({ database: process.env.DB_NAME || 'minipacs' });
    
    // Create roles table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS roles (
        name VARCHAR(50) PRIMARY KEY,
        permissions JSON
      )
    `);
    console.log('Roles table created.');
    
    // Insert default roles
    await connection.query(`
      INSERT IGNORE INTO roles (name, permissions) VALUES 
      ('Admin', '["modify", "delete", "view", "settings"]'),
      ('Radiographer', '["view", "modify"]'),
      ('Radiologist', '["view", "report"]'),
      ('Other', '["view"]')
    `);
    console.log('Default roles inserted.');
    
    // Create users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255),
        role VARCHAR(50),
        orthanc_username VARCHAR(255),
        orthanc_password VARCHAR(255),
        FOREIGN KEY (role) REFERENCES roles(name) ON DELETE SET NULL
      )
    `);
    console.log('Users table created.');

    console.log('Database initialization completed.');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    if (connection) await connection.end();
  }
}

initDb();
