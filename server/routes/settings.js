import express from 'express';
import { getConnection } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

router.use(authenticateToken);

// Get settings
router.get('/', requireAdmin, async (req, res) => {
  try {
    const configPath = join(__dirname, '../../.env');
    const envContent = await fs.readFile(configPath, 'utf-8');
    
    const settings = {};
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        settings[key] = value;
      }
    });

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update settings
router.put('/', requireAdmin, async (req, res) => {
  try {
    const { settings } = req.body;
    const configPath = join(__dirname, '../../.env');
    
    const existingContent = await fs.readFile(configPath, 'utf-8');
    const existingSettings = {};
    existingContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        existingSettings[key] = value;
      }
    });

    const newSettings = { ...existingSettings, ...settings };

    const envContent = Object.entries(newSettings)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    await fs.writeFile(configPath, envContent);
    
    res.json(newSettings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
