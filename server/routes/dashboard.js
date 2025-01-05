import express from 'express';
import { getConnection } from '../config/database.js';

const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    const connection = await getConnection();
    
    // Total number of test results
    const [[totalRunsResult]] = await connection.query(
      'SELECT COUNT(*) as total FROM test_results'
    );
    const totalRuns = totalRunsResult.total;

    // Average scores by model
    const [modelPerformance] = await connection.query(`
      SELECT 
        model_name,
        model_implementation,
        COUNT(*) as total_tests,
        ROUND(AVG(overall_score), 2) as avg_score
      FROM test_results
      GROUP BY model_name, model_implementation
      ORDER BY avg_score DESC
      LIMIT 5
    `);

    // Recent test results with module info
    const [recentRuns] = await connection.query(`
      SELECT 
        tr.id,
        tr.model_name,
        tr.model_implementation,
        tr.overall_score,
        tr.grading_method,
        tr.created_at,
        m.name as module_name,
        m.description as module_description
      FROM test_results tr
      LEFT JOIN modules m ON tr.module_id = m.id
      ORDER BY tr.created_at DESC
      LIMIT 10
    `);

    // Stats by grading method
    const [gradingMethodStats] = await connection.query(`
      SELECT 
        grading_method,
        COUNT(*) as total_tests,
        ROUND(AVG(overall_score), 2) as avg_score
      FROM test_results
      GROUP BY grading_method
      ORDER BY total_tests DESC
    `);

    // Module coverage
    const [moduleCoverage] = await connection.query(`
      SELECT 
        m.name as module_name,
        COUNT(tr.id) as test_count,
        ROUND(AVG(tr.overall_score), 2) as avg_score
      FROM modules m
      LEFT JOIN test_results tr ON m.id = tr.module_id
      GROUP BY m.id, m.name
      ORDER BY test_count DESC
    `);

    res.json({
      totalRuns,
      modelPerformance,
      recentRuns,
      gradingMethodStats,
      moduleCoverage
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard statistics',
      details: error.message 
    });
  }
});

export default router;
