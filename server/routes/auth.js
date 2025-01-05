import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getConnection } from '../config/database.js';
import fs from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

async function getJwtSecret() {
  try {
    const configPath = join(__dirname, '../../.env.encrypted');
    const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    return config.jwtSecret;
  } catch (error) {
    console.error('Error reading JWT secret:', error);
    return 'your-secret-key';
  }
}

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const connection = await getConnection();
    
    const [users] = await connection.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    const user = users[0];
    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const jwtSecret = await getJwtSecret();
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
