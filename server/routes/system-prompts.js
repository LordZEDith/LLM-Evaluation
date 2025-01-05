import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getConnection } from '../config/database.js';

const router = express.Router();

router.use(authenticateToken);

// Get all system prompts
router.get('/', async (req, res) => {
    try {
        const connection = await getConnection();
        const [prompts] = await connection.query(
            'SELECT * FROM system_prompts ORDER BY created_at DESC'
        );
        
        const formattedPrompts = prompts.map(prompt => ({
            ...prompt,
            tags: JSON.parse(prompt.tags || '[]'),
            metadata: JSON.parse(prompt.metadata || '{}')
        }));
        
        res.json(formattedPrompts);
    } catch (error) {
        console.error('Error fetching system prompts:', error);
        res.status(500).json({ error: 'Failed to fetch system prompts' });
    }
});

// Create new system prompt
router.post('/', async (req, res) => {
    try {
        const { name, content, description, tags, metadata } = req.body;
        const connection = await getConnection();
        
        const [result] = await connection.query(
            'INSERT INTO system_prompts (name, content, description, tags, metadata) VALUES (?, ?, ?, ?, ?)',
            [
                name,
                content,
                description || '',
                JSON.stringify(tags || []),
                JSON.stringify(metadata || {})
            ]
        );
        
        const [newPrompt] = await connection.query(
            'SELECT * FROM system_prompts WHERE id = ?',
            [result.insertId]
        );
        
        res.status(201).json({
            ...newPrompt[0],
            tags: JSON.parse(newPrompt[0].tags || '[]'),
            metadata: JSON.parse(newPrompt[0].metadata || '{}')
        });
    } catch (error) {
        console.error('Error creating system prompt:', error);
        res.status(500).json({ error: 'Failed to create system prompt' });
    }
});

// Update system prompt
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, content, description, tags, metadata } = req.body;
        const connection = await getConnection();
        
        await connection.query(
            'UPDATE system_prompts SET name = ?, content = ?, description = ?, tags = ?, metadata = ? WHERE id = ?',
            [
                name,
                content,
                description || '',
                JSON.stringify(tags || []),
                JSON.stringify(metadata || {}),
                id
            ]
        );
        
        const [updatedPrompt] = await connection.query(
            'SELECT * FROM system_prompts WHERE id = ?',
            [id]
        );
        
        if (updatedPrompt.length === 0) {
            return res.status(404).json({ error: 'System prompt not found' });
        }
        
        res.json({
            ...updatedPrompt[0],
            tags: JSON.parse(updatedPrompt[0].tags || '[]'),
            metadata: JSON.parse(updatedPrompt[0].metadata || '{}')
        });
    } catch (error) {
        console.error('Error updating system prompt:', error);
        res.status(500).json({ error: 'Failed to update system prompt' });
    }
});

// Delete system prompt
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const connection = await getConnection();
        
        const [result] = await connection.query(
            'DELETE FROM system_prompts WHERE id = ?',
            [id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'System prompt not found' });
        }
        
        res.json({ message: 'System prompt deleted successfully' });
    } catch (error) {
        console.error('Error deleting system prompt:', error);
        res.status(500).json({ error: 'Failed to delete system prompt' });
    }
});

export default router; 