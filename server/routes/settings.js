import express from 'express';
import pool from '../db.js';

const router = express.Router();

// Get settings
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM system_settings');
    const settings = rows.reduce((acc, row) => {
      acc[row.setting_key] = row.setting_value;
      return acc;
    }, {});
    
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update settings
router.post('/', async (req, res) => {
  const { institution_name } = req.body;
  
  try {
    if (institution_name) {
      await pool.query(
        'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        ['institution_name', institution_name, institution_name]
      );
    }
    
    res.json({ success: true, message: 'Settings updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
