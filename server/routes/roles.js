import express from 'express';
import pool from '../db.js';

const router = express.Router();

// Get all roles
router.get('/', async (req, res) => {
  try {
    const [roles] = await pool.query('SELECT * FROM roles');
    res.json(roles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update role permissions
router.put('/:name', async (req, res) => {
  const { name } = req.params;
  const { permissions } = req.body; // Expect JSON array

  try {
    await pool.query('UPDATE roles SET permissions = ? WHERE name = ?', [JSON.stringify(permissions), name]);
    res.json({ message: 'Role updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
