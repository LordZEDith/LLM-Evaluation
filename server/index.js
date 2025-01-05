import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import installRoutes from './routes/install.js';
import authRoutes from './routes/auth.js';
import testCasesRoutes from './routes/test-cases.js';
import dashboardRoutes from './routes/dashboard.js';
import usersRoutes from './routes/users.js';
import settingsRoutes from './routes/settings.js';
import modulesRoutes from './routes/modules.js';
import resultsRoutes from './routes/results.js';
import systemPromptsRoutes from './routes/system-prompts.js';
import testRunsRouter from './routes/test-runs.js';
import { checkInstallation } from './middleware/installation.js';
import { authenticateToken } from './middleware/auth.js';
import modelsRouter from './routes/models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function loadEncryptedConfig() {
  try {
    const configPath = join(__dirname, '../.env.encrypted');
    const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    Object.entries(config).forEach(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number') {
        process.env[key] = value.toString();
      }
    });
  } catch (error) {
    console.error('Error loading encrypted config:', error);
  }
}

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Load encrypted config before setting up routes
await loadEncryptedConfig();

// Public routes
app.use('/api/install', installRoutes);
app.use('/api/auth', authRoutes);

app.use(checkInstallation);

// Protected routes
app.use('/api/test-cases', authenticateToken, testCasesRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);
app.use('/api/users', authenticateToken, usersRoutes);
app.use('/api/settings', authenticateToken, settingsRoutes);
app.use('/api/modules', authenticateToken, modulesRoutes);
app.use('/api/results', authenticateToken, resultsRoutes);
app.use('/api/system-prompts', authenticateToken, systemPromptsRoutes);
app.use('/api/test-runs', authenticateToken, testRunsRouter);
app.use('/api/models', modelsRouter);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
