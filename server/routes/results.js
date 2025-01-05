import express from 'express';
import { getConnection } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get all test results
router.get('/', async (req, res) => {
  try {
    const connection = await getConnection();
    
    // Get all test results with their associated data
    const [results] = await connection.execute(`
      SELECT 
        tr.id,
        tr.test_case_id,
        tr.module_id,
        tr.model_implementation,
        tr.model_name,
        tr.prompt,
        tr.model_response,
        tr.reference_response,
        tr.grading_method,
        tr.overall_score,
        tr.attribute_scores,
        tr.system_prompt_id,
        tr.system_prompt_content,
        tr.created_at,
        m.name as module_name,
        sp.name as system_prompt_name
      FROM test_results tr
      LEFT JOIN modules m ON tr.module_id = m.id
      LEFT JOIN system_prompts sp ON tr.system_prompt_id = sp.id
      ORDER BY tr.created_at DESC
    `);

    res.json(results);
  } catch (error) {
    console.error('Error fetching test results:', error);
    res.status(500).json({ error: 'Failed to fetch test results' });
  }
});

// Get details for a specific test result
router.get('/:id', async (req, res) => {
  try {
    const connection = await getConnection();
    const [results] = await connection.execute(`
      SELECT 
        tr.id,
        tr.test_case_id,
        tr.module_id,
        tr.model_implementation,
        tr.model_name,
        tr.prompt,
        tr.model_response,
        tr.reference_response,
        tr.grading_method,
        tr.overall_score,
        tr.attribute_scores,
        tr.system_prompt_id,
        tr.system_prompt_content,
        tr.created_at,
        m.name as module_name,
        sp.name as system_prompt_name
      FROM test_results tr
      LEFT JOIN modules m ON tr.module_id = m.id
      LEFT JOIN system_prompts sp ON tr.system_prompt_id = sp.id
      WHERE tr.id = ?
    `, [req.params.id]);

    if (results.length === 0) {
      return res.status(404).json({ error: 'Test result not found' });
    }

    res.json(results[0]);
  } catch (error) {
    console.error('Error fetching test result details:', error);
    res.status(500).json({ error: 'Failed to fetch test result details' });
  }
});

export default router; 