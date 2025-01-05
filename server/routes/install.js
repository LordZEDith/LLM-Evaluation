import express from 'express';
import mysql from 'mysql2/promise';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeDatabase, createTables } from '../config/database.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

router.get('/status', async (req, res) => {
  try {
    const configPath = join(__dirname, '../../.env.encrypted');
    const isInstalled = await fs.access(configPath)
      .then(() => true)
      .catch(() => false);
    
    res.json({ installed: isInstalled });
  } catch (error) {
    console.error('Failed to check installation status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to check installation status' 
    });
  }
});

router.post('/test-db', async (req, res) => {
  try {
    const { host, port, database, user, password } = req.body;
    
    const tempConnection = await mysql.createConnection({
      host,
      port,
      user,
      password
    });

    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS ${database}`);
    await tempConnection.end();

    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database
    });

    await connection.end();
    res.json({ success: true });
  } catch (error) {
    console.error('Database connection test failed:', error);
    res.status(400).json({ 
      success: false, 
      error: `Database connection failed: ${error.message}` 
    });
  }
});

router.post('/test-smtp', async (req, res) => {
  try {
    const { host, port, user, password, fromEmail, fromName } = req.body;
    
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: parseInt(port) === 465,
      auth: {
        user,
        pass: password
      }
    });

    await transporter.verify();

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: fromEmail,
      subject: 'SMTP Test',
      text: 'This is a test email to verify SMTP configuration.',
      html: `
        <h1>SMTP Test Successful</h1>
        <p>This email confirms that your SMTP settings are configured correctly.</p>
        <p>Sent from: ${fromName} (${fromEmail})</p>
      `
    });

    res.json({ success: true });
  } catch (error) {
    console.error('SMTP connection test failed:', error);
    res.status(400).json({ 
      success: false, 
      error: `SMTP connection failed: ${error.message}` 
    });
  }
});

router.post('/complete', async (req, res) => {
  try {
    const { database, smtp, admin } = req.body;

    const encryptionKey = crypto.randomBytes(32).toString('hex');
    const jwtSecret = crypto.randomBytes(32).toString('hex');

    const config = {
      database: {
        host: database.host,
        port: database.port,
        name: database.name,
        user: database.user,
        password: encrypt(database.password, encryptionKey)
      },
      smtp: {
        host: smtp.host,
        port: smtp.port,
        user: smtp.user,
        password: encrypt(smtp.password, encryptionKey),
        fromEmail: smtp.fromEmail
      },
      encryptionKey,
      jwtSecret
    };

    await initializeDatabase({
      host: database.host,
      port: database.port,
      database: database.name,
      user: database.user,
      password: database.password
    });

    await createTables();

    const connection = await mysql.createConnection({
      host: database.host,
      port: database.port,
      user: database.user,
      password: database.password,
      database: database.name
    });

    const hashedPassword = await bcrypt.hash(admin.password, 10);
    await connection.query(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
      [admin.email, hashedPassword, 'admin']
    );

    const configPath = join(__dirname, '../../.env.encrypted');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    res.json({ success: true });
  } catch (error) {
    console.error('Installation failed:', error);
    res.status(500).json({ 
      success: false, 
      error: `Installation failed: ${error.message}` 
    });
  }
});

function encrypt(text, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export default router;
