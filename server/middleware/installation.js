import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function isInstalled() {
  try {
    const configPath = join(__dirname, '../../.env.encrypted');
    await fs.access(configPath);
    return true;
  } catch {
    return false;
  }
}

export async function checkInstallation(req, res, next) {
  if (!await isInstalled()) {
    return res.status(503).json({ error: 'System not installed' });
  }
  next();
}
