import express from 'express';
import bcrypt from 'bcryptjs';
import { getConnection } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get all users (admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const connection = await getConnection();
    const [users] = await connection.query(
      'SELECT id, email, role, created_at FROM users'
    );
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create user (admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const connection = await getConnection();

    // Check if user exists
    const [existing] = await connection.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    
    const [result] = await connection.query(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
      [email, passwordHash, role]
    );

    const [newUser] = await connection.query(
      'SELECT id, email, role, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json(newUser[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, role } = req.body;
    const connection = await getConnection();

    if (req.user.id !== parseInt(id) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (req.user.role !== 'admin' && role) {
      return res.status(403).json({ error: 'Cannot change role' });
    }

    let updates = [];
    let values = [];

    if (email) {
      updates.push('email = ?');
      values.push(email);
    }

    if (password) {
      updates.push('password_hash = ?');
      values.push(await bcrypt.hash(password, 10));
    }

    if (role && req.user.role === 'admin') {
      updates.push('role = ?');
      values.push(role);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    values.push(id);

    await connection.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const [updatedUser] = await connection.query(
      'SELECT id, email, role, created_at FROM users WHERE id = ?',
      [id]
    );

    if (updatedUser.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(updatedUser[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete user (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await getConnection();

    const [admins] = await connection.query(
      'SELECT COUNT(*) as count FROM users WHERE role = "admin"'
    );
    const [userToDelete] = await connection.query(
      'SELECT role FROM users WHERE id = ?',
      [id]
    );

    if (admins[0].count === 1 && userToDelete[0]?.role === 'admin') {
      return res.status(400).json({ error: 'Cannot delete the last admin user' });
    }

    const [result] = await connection.query(
      'DELETE FROM users WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
