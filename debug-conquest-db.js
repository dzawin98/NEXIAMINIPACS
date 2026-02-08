
import mysql from 'mysql2/promise';

const password = 'nexia';
const user = 'root';
const host = 'localhost';

async function testConnection(dbName) {
  console.log(`Testing connection to database: ${dbName}...`);
  try {
    const connection = await mysql.createConnection({
      host,
      user,
      password,
      database: dbName
    });
    console.log(`✅ Connected to ${dbName}`);
    
    try {
      const [rows] = await connection.query('SHOW TABLES LIKE "dicomstudies"');
      if (rows.length > 0) {
        console.log(`✅ Table 'dicomstudies' FOUND in ${dbName}`);
        return true;
      } else {
        console.log(`❌ Table 'dicomstudies' NOT found in ${dbName}`);
      }
    } catch (e) {
      console.log(`❌ Error querying tables in ${dbName}: ${e.message}`);
    } finally {
      await connection.end();
    }
  } catch (err) {
    console.log(`❌ Failed to connect to ${dbName}: ${err.message}`);
  }
  return false;
}

async function run() {
  const databases = ['conquest', 'nexia', 'minipacs', 'dicom'];
  
  for (const db of databases) {
    const found = await testConnection(db);
    if (found) {
      console.log(`\n🎉 SUCCESS! Conquest seems to be using database: ${db}`);
      process.exit(0);
    }
  }
  
  console.log('\n❌ Could not find Conquest tables in any common database.');
}

run();
