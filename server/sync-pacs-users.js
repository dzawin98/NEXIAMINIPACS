import pool from './db.js';
import { pacsConfigService } from './pacsConfig.js';

async function sync() {
  try {
    console.log('Fetching users from DB...');
    const [users] = await pool.query('SELECT username, password FROM users');
    console.log(`Found ${users.length} users.`);

    console.log('Syncing to PACS config...');
    const success = await pacsConfigService.syncUsers(users);

    if (success) {
      console.log('Sync completed successfully.');
      console.log('IMPORTANT: You must RESTART the PACS service for changes to take effect.');
    } else {
      console.error('Sync failed or config file not found.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

sync();
