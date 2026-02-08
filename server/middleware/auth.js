
import pool from '../db.js';

export const requireAuth = async (req, res, next) => {
  // Allow OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    // If no auth header, but maybe it's a browser request to an image/zip directly?
    // In that case, we might want to prompt basic auth dialog?
    // But for API usage, 401 JSON is better.
    // For now, strict API security.
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const [type, credentials] = authHeader.split(' ');

  if (type !== 'Basic' || !credentials) {
    return res.status(401).json({ error: 'Invalid authorization format. Basic Auth required.' });
  }

  try {
    const decoded = Buffer.from(credentials, 'base64').toString();
    const [username, password] = decoded.split(':');

    if (!username || !password) {
        return res.status(401).json({ error: 'Invalid credentials format' });
    }

    // Check user in DB
    // Frontend logic sends: btoa(username + ':' + user.token) where token is pacs_password (or password)
    // So 'password' here is potentially the orthanc_password OR the db password.
    // We check both to be safe and compatible.
    
    const [users] = await pool.query(
      'SELECT id, username, role, orthanc_username, orthanc_password FROM users WHERE username = ? AND (orthanc_password = ? OR password = ?)', 
      [username, password, password]
    );

    if (users.length === 0) {
      // Security: slow down response slightly to prevent timing attacks? (optional)
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Attach user to request for downstream use
    req.user = users[0];
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
};
