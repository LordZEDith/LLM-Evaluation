import express from 'express';
import { getConnection } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get all test runs with additional info
router.get('/', async (req, res) => {
  try {
    const connection = await getConnection();
    
    // Get active runs (pending and running) with individual test case info
    const [activeRuns] = await connection.execute(`
      SELECT 
        tr.*,
        tc.input,
        tc.module_id,
        m.name as module_name,
        m.description as module_description,
        tr.created_at,
        tr.updated_at
      FROM test_runs tr
      LEFT JOIN test_cases tc ON tr.test_case_id = tc.id
      LEFT JOIN modules m ON tc.module_id = m.id
      WHERE tr.status IN ('pending', 'running')
      ORDER BY 
        CASE tr.status
          WHEN 'running' THEN 1
          WHEN 'pending' THEN 2
        END,
        tr.created_at DESC
    `);

    // Get completed runs grouped by module and timestamp (rounded to minute)
    const [completedRuns] = await connection.execute(`
      SELECT 
        m.name as module_name,
        m.id as module_id,
        DATE_FORMAT(tr.updated_at, '%Y-%m-%d %H:%i:00') as completion_time,
        COUNT(DISTINCT tr.test_case_id) as test_case_count,
        GROUP_CONCAT(DISTINCT tr.grading_method) as grading_methods,
        tr.status,
        MIN(tr.created_at) as created_at,
        MAX(tr.updated_at) as updated_at
      FROM test_runs tr
      LEFT JOIN test_cases tc ON tr.test_case_id = tc.id
      LEFT JOIN modules m ON tc.module_id = m.id
      WHERE tr.status IN ('completed', 'failed')
      GROUP BY 
        m.id,
        m.name,
        DATE_FORMAT(tr.updated_at, '%Y-%m-%d %H:%i:00'),
        tr.status
      ORDER BY tr.updated_at DESC
      LIMIT 50
    `);
    
    res.json({
      activeRuns,
      completedRuns: completedRuns.map(run => ({
        ...run,
        grading_methods: run.grading_methods ? run.grading_methods.split(',') : []
      }))
    });
  } catch (error) {
    console.error('Error fetching test runs:', error);
    res.status(500).json({ error: 'Failed to fetch test runs' });
  }
});

// Cancel a test run
router.post('/:id/cancel', async (req, res) => {
  try {
    const connection = await getConnection();
    
    await connection.execute(
      'UPDATE test_runs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['failed', req.params.id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error canceling test run:', error);
    res.status(500).json({ error: 'Failed to cancel test run' });
  }
});

export default router; 