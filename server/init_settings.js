import pool from './db.js';

async function initSettings() {
  const connection = await pool.getConnection();
  try {
    console.log('Initializing system settings...');

    // 1. Create settings table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(50) PRIMARY KEY,
        setting_value TEXT
      )
    `);
    console.log('Settings table checked/created.');

    // 2. Insert default institution name if not exists
    const [settings] = await connection.query('SELECT * FROM system_settings WHERE setting_key = ?', ['institution_name']);
    if (settings.length === 0) {
      await connection.query('INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)', ['institution_name', 'Medical Center']);
      console.log('Default institution name set to "Medical Center"');
    }

    // 3. Create superadmin user
    const [users] = await connection.query('SELECT * FROM users WHERE username = ?', ['superadmin']);
    if (users.length === 0) {
      await connection.query(
        'INSERT INTO users (username, password, role, orthanc_username, orthanc_password) VALUES (?, ?, ?, ?, ?)',
        ['superadmin', 'nexiaadmin', 'Admin', 'superadmin', 'nexiaadmin']
      );
      console.log('Superadmin user created.');
    } else {
      console.log('Superadmin user already exists.');
    }

    // 4. Create requested superuser if not exists
    const [superuser] = await connection.query('SELECT * FROM users WHERE username = ?', ['superuser']);
    if (superuser.length === 0) {
      await connection.query(
        'INSERT INTO users (username, password, role, orthanc_username, orthanc_password) VALUES (?, ?, ?, ?, ?)',
        ['superuser', 'nexiaadmin', 'Admin', 'superuser', 'nexiaadmin']
      );
      console.log('Superuser user created.');
    } else {
      console.log('Superuser user already exists.');
    }

  } catch (error) {
    console.error('Initialization failed:', error);
  } finally {
    connection.release();
    process.exit();
  }
}

initSettings();
