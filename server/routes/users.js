import express from 'express';
import pool from '../db.js';
import { pacsConfigService } from '../pacsConfig.js';

const router = express.Router();

// Get all users
router.get('/', async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, username, role, orthanc_username as pacs_username, orthanc_password as pacs_password FROM users');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create user
router.post('/', async (req, res) => {
  const { username, password, role, pacs_username, pacs_password } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password and role are required' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Check if user exists
    const [existing] = await connection.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Insert into DB
    const [result] = await connection.query(
      'INSERT INTO users (username, password, role, orthanc_username, orthanc_password) VALUES (?, ?, ?, ?, ?)',
      [username, password, role, pacs_username || username, pacs_password || password]
    );

    // Sync with PACS - we still sync the SYSTEM user to PACS for now to maintain previous behavior,
    // OR we could sync the PACS user if provided?
    // The user said "system locks based on pacs user".
    // If we manage PACS users, we should probably sync the PACS credentials if they are provided.
    // However, if the user manually sets a PACS User that already exists (e.g. "admin"), we shouldn't overwrite it blindly.
    // For safety, let's keep the existing behavior: sync the SYSTEM user.
    // But wait, if the user sets a DIFFERENT pacs user, maybe they don't want the system user to be in PACS at all?
    // Let's stick to the request: "stored in database". We will use these for auth.
    // We will continue to add the system user to PACS to ensure they CAN login if they want to use same creds.
    
    await pacsConfigService.addUser(username, password);

    await connection.commit();
    res.status(201).json({ id: result.insertId, username, role });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Update user
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { username, password, role, pacs_username, pacs_password } = req.body;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Get old username to remove from PACS if changed
    const [oldUser] = await connection.query('SELECT username FROM users WHERE id = ?', [id]);
    if (oldUser.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const oldUsername = oldUser[0].username;

    let query = 'UPDATE users SET role = ?';
    let params = [role];

    if (username) {
        query += ', username = ?';
        params.push(username);
        
        // Auto-update pacs_username if not explicitly provided
        if (pacs_username === undefined) {
            query += ', orthanc_username = ?';
            params.push(username);
        }
    }
    if (password) {
        query += ', password = ?';
        params.push(password);
        
        // Auto-update pacs_password if not explicitly provided
        if (pacs_password === undefined) {
            query += ', orthanc_password = ?';
            params.push(password);
        }
    }
    if (pacs_username !== undefined) {
        query += ', orthanc_username = ?';
        params.push(pacs_username);
    }
    if (pacs_password !== undefined) {
        query += ', orthanc_password = ?';
        params.push(pacs_password);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await connection.query(query, params);

    // Sync with PACS
    // If username changed, remove old and add new
    if (username && username !== oldUsername) {
        await pacsConfigService.removeUser(oldUsername);
        await pacsConfigService.addUser(username, password || (await pool.query('SELECT password FROM users WHERE id=?',[id]))[0][0].password);
    } 
    // If just password changed
    else if (password) {
        await pacsConfigService.updateUser(username || oldUsername, password);
    }

    await connection.commit();
    res.json({ id, username, role });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [user] = await connection.query('SELECT username FROM users WHERE id = ?', [id]);
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await connection.query('DELETE FROM users WHERE id = ?', [id]);

    // Sync with PACS
    await pacsConfigService.removeUser(user[0].username);

    await connection.commit();
    res.json({ message: 'User deleted' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    // Fetch user and their role permissions
    const [users] = await pool.query(`
      SELECT u.id, u.username, u.password, u.role, u.orthanc_username as pacs_username, u.orthanc_password as pacs_password, r.permissions 
      FROM users u
      LEFT JOIN roles r ON u.role = r.name
      WHERE u.username = ? AND u.password = ?
    `, [username, password]);

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    
    // Parse permissions if string
    let permissions = [];
    if (typeof user.permissions === 'string') {
        try {
            permissions = JSON.parse(user.permissions);
        } catch (e) {
            permissions = [];
        }
    } else if (Array.isArray(user.permissions)) {
        permissions = user.permissions;
    }

    const pacsUser = user.pacs_username || user.username;
    const pacsPass = user.pacs_password || user.password;

    res.json({
      id: user.id,
      username: user.username,
      name: user.name || user.username,
      role: user.role,
      permissions: permissions || [],
      pacs_username: pacsUser,
      token: pacsPass
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
