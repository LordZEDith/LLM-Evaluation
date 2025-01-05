import express from 'express';
import { getConnection } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get all test cases
router.get('/', async (req, res) => {
  try {
    const connection = await getConnection();
    const [testCases] = await connection.query(
      'SELECT * FROM test_cases ORDER BY created_at DESC'
    );
    res.json(testCases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create test case
router.post('/', async (req, res) => {
  try {
    const { input, experiment_response, reference_response, grading_method } = req.body;
    const connection = await getConnection();
    
    const [result] = await connection.query(
      'INSERT INTO test_cases (input, experiment_response, reference_response, grading_method) VALUES (?, ?, ?, ?)',
      [input, experiment_response || null, reference_response, grading_method]
    );

    const [newTestCase] = await connection.query(
      'SELECT * FROM test_cases WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json(newTestCase[0]);
  } catch (error) {
    console.error('Error creating test case:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update test case
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { input, experiment_response, reference_response, grading_method } = req.body;
    const connection = await getConnection();

    await connection.query(
      `UPDATE test_cases 
       SET input = ?, experiment_response = ?, reference_response = ?, grading_method = ? 
       WHERE id = ?`,
      [input, experiment_response || null, reference_response, grading_method, id]
    );

    const [updatedTestCase] = await connection.query(
      'SELECT * FROM test_cases WHERE id = ?',
      [id]
    );

    if (updatedTestCase.length === 0) {
      return res.status(404).json({ error: 'Test case not found' });
    }

    res.json(updatedTestCase[0]);
  } catch (error) {
    console.error('Error updating test case:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete test case
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await getConnection();

    const [result] = await connection.query(
      'DELETE FROM test_cases WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Test case not found' });
    }

    res.json({ message: 'Test case deleted successfully' });
  } catch (error) {
    console.error('Error deleting test case:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
