import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateToken } from '../middleware/auth.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { getConnection } from '../config/database.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.use(authenticateToken);

router.get('/config', async (req, res) => {
    try {
        const pythonProcess = spawn('python', [
            path.join(__dirname, '../../llm_evaluation/get_models_config.py')
        ]);

        let result = '';

        pythonProcess.stdout.on('data', (data) => {
            result += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`Python Error: ${data}`);
        });

        pythonProcess.on('close', async (code) => {
            if (code !== 0) {
                return res.status(500).json({ error: 'Failed to get models configuration' });
            }
            try {
                const config = JSON.parse(result);
                
                const connection = await getConnection();
                for (const model of config) {
                    try {
                        const [existingModels] = await connection.query(
                            'SELECT id, config FROM models WHERE name = ?',
                            [model.name]
                        );

                        const newConfig = JSON.stringify(model);

                        if (existingModels.length === 0) {
                            await connection.query(
                                'INSERT INTO models (name, type, description, config) VALUES (?, ?, ?, ?)',
                                [model.name, model.type || 'unknown', model.description || '', newConfig]
                            );
                        } else {
                            const existingConfig = existingModels[0].config;
                            if (existingConfig !== newConfig) {
                                await connection.query(
                                    'UPDATE models SET type = ?, description = ?, config = ? WHERE name = ?',
                                    [model.type || 'unknown', model.description || '', newConfig, model.name]
                                );
                            }
                        }
                        
                        const [models] = await connection.query(
                            'SELECT id FROM models WHERE name = ?',
                            [model.name]
                        );
                        
                        if (models.length > 0) {
                            await connection.query(
                                'INSERT IGNORE INTO model_api_keys (model_id, encrypted_key, iv) VALUES (?, ?, ?)',
                                [models[0].id, '', '']
                            );
                        }
                    } catch (error) {
                        console.error(`Error registering model ${model.name}:`, error);
                    }
                }
                
                res.json(config);
            } catch (error) {
                res.status(500).json({ error: 'Failed to parse models configuration' });
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Store API key for a model
router.post('/:modelName/api-key', async (req, res) => {
    const { modelName } = req.params;
    const { apiKey } = req.body;

    try {
        const connection = await getConnection();
        const [models] = await connection.query(
            'SELECT id FROM models WHERE name = ?',
            [modelName]
        );

        if (models.length === 0) {
            throw new Error(`Model ${modelName} not found`);
        }

        const modelId = models[0].id;
        
        let encryptedKey = '';
        let iv = '';
        if (apiKey) {
            const encryptionResult = await encrypt(apiKey);
            [iv, encryptedKey] = encryptionResult.split(':');
        }
        
        const [existingKeys] = await connection.query(
            'SELECT id FROM model_api_keys WHERE model_id = ?',
            [modelId]
        );

        if (existingKeys.length > 0) {
            await connection.query(
                'UPDATE model_api_keys SET encrypted_key = ?, iv = ? WHERE model_id = ?',
                [encryptedKey, iv, modelId]
            );
        } else {
            await connection.query(
                'INSERT INTO model_api_keys (model_id, encrypted_key, iv) VALUES (?, ?, ?)',
                [modelId, encryptedKey, iv]
            );
        }

        res.json({ apiKey: apiKey || null });
    } catch (error) {
        console.error('Error storing API key:', error);
        res.status(500).json({ error: 'Failed to store API key' });
    }
});

// API key for a model
router.get('/:modelName/api-key', async (req, res) => {
    const { modelName } = req.params;

    try {
        const connection = await getConnection();

        const [models] = await connection.query(
            'SELECT id FROM models WHERE name = ?',
            [modelName]
        );

        if (models.length === 0) {
            return res.json({ apiKey: null });
        }

        const modelId = models[0].id;

        const [rows] = await connection.query(
            'SELECT encrypted_key, iv FROM model_api_keys WHERE model_id = ?',
            [modelId]
        );

        if (rows.length === 0) {
            await connection.query(
                'INSERT INTO model_api_keys (model_id, encrypted_key, iv) VALUES (?, ?, ?)',
                [modelId, '', '']
            );
            return res.json({ apiKey: null });
        }

        if (!rows[0].encrypted_key || !rows[0].iv) {
            return res.json({ apiKey: null });
        }

        const decryptedApiKey = await decrypt(rows[0].iv + ':' + rows[0].encrypted_key);

        res.json({ apiKey: decryptedApiKey });
    } catch (error) {
        console.error('Error retrieving API key:', error);
        res.status(500).json({ error: 'Failed to retrieve API key' });
    }
});

export default router; 