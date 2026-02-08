
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const dbConfig = {
  host: process.env.CONQUEST_DB_HOST || 'localhost',
  user: process.env.CONQUEST_DB_USER || 'root',
  password: process.env.CONQUEST_DB_PASSWORD || 'nexia',
  database: process.env.CONQUEST_DB_NAME || 'nexia'
};

async function fixSchema() {
  const pool = mysql.createPool(dbConfig);
  try {
    console.log('Checking dicomseries columns...');
    const [rows] = await pool.query('DESCRIBE dicomseries');
    const hasPatientID = rows.some(r => r.Field === 'PatientID');
    
    if (hasPatientID) {
      console.log('dicomseries already has PatientID column.');
    } else {
      console.log('Adding PatientID column to dicomseries...');
      await pool.query('ALTER TABLE dicomseries ADD COLUMN PatientID VARCHAR(64)');
      console.log('Column added.');
      
      // Optional: Populate it from SeriesPat
      console.log('Populating PatientID from SeriesPat...');
      await pool.query('UPDATE dicomseries SET PatientID = SeriesPat WHERE PatientID IS NULL');
      console.log('Population done.');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

fixSchema();
