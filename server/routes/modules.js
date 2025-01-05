import express from 'express';
import { getConnection } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { spawn } from 'child_process';
import { decrypt } from '../utils/encryption.js';
import path from 'path';

const VALID_GRADING_METHODS = ['BLEU', 'ROUGE', 'METEOR', 'LLM_JUDGE'];
const router = express.Router();

// GET /debug/test-cases - Get all test cases (for debugging)
router.get('/debug/test-cases', async (req, res) => {
  try {
    const connection = await getConnection();
    const [testCases] = await connection.execute(
      'SELECT * FROM test_cases ORDER BY created_at DESC'
    );

    const [testCasesWithModule] = await connection.execute(`
      SELECT 
        tc.*,
        m.name as module_name
      FROM test_cases tc
      LEFT JOIN modules m ON tc.module_id = m.id
      ORDER BY tc.created_at DESC
    `);

    res.json({
      raw_test_cases: testCases,
      test_cases_with_module: testCasesWithModule
    });
  } catch (error) {
    console.error('Error fetching all test cases:', error);
    res.status(500).json({ error: 'Failed to fetch test cases' });
  }
});

router.use(authenticateToken);

// GET /grading-methods - Get available grading methods
router.get('/grading-methods', async (req, res) => {
  res.json(VALID_GRADING_METHODS);
});

// GET / - Get all modules
router.get('/', async (req, res) => {
  try {
    const connection = await getConnection();
    const [modules] = await connection.execute(
      'SELECT id, name, description, purpose, relevance FROM modules'
    );

    for (const module of modules) {
      const [gradingMethods] = await connection.execute(
        'SELECT grading_method FROM module_grading_methods WHERE module_id = ?',
        [module.id]
      );
      module.grading_methods = gradingMethods.map(gm => gm.grading_method);
    }

    res.json(modules);
  } catch (error) {
    console.error('Error fetching modules:', error);
    res.status(500).json({ error: 'Failed to fetch modules' });
  }
});

// GET /:id - Get a single module with its test cases and grading methods
router.get('/:id', async (req, res) => {
  try {
    const connection = await getConnection();
    
    const [modules] = await connection.execute(`
      SELECT 
        m.*,
        sp.id as system_prompt_id,
        sp.name as system_prompt_name,
        sp.content as system_prompt_content
      FROM modules m
      LEFT JOIN system_prompts sp ON m.system_prompt_id = sp.id
      WHERE m.id = ?
    `, [req.params.id]);

    if (modules.length === 0) {
      return res.status(404).json({ error: 'Module not found' });
    }

    const module = modules[0];
    
    const [testCases] = await connection.execute(`
      SELECT tc.*, sp.name as system_prompt_name
      FROM test_cases tc
      LEFT JOIN system_prompts sp ON tc.system_prompt_id = sp.id
      WHERE tc.module_id = ?
    `, [module.id]);

    const [gradingMethods] = await connection.execute(`
      SELECT grading_method FROM module_grading_methods WHERE module_id = ?
    `, [module.id]);

    const response = {
      ...module,
      test_cases: testCases,
      grading_methods: gradingMethods.map(gm => gm.grading_method)
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching module details:', error);
    res.status(500).json({ error: 'Failed to fetch module details' });
  }
});

// POST / - Create a new module
router.post('/', async (req, res) => {
  try {
    const { name, description, purpose, relevance, grading_methods, system_prompt_id } = req.body;
    const connection = await getConnection();

    await connection.query('START TRANSACTION');

    try {
      const [moduleResult] = await connection.execute(
        'INSERT INTO modules (name, description, purpose, relevance, system_prompt_id) VALUES (?, ?, ?, ?, ?)',
        [name, description, purpose, relevance, system_prompt_id || null]
      );

      const moduleId = moduleResult.insertId;

      for (const method of grading_methods) {
        await connection.execute(
          'INSERT INTO module_grading_methods (module_id, grading_method) VALUES (?, ?)',
          [moduleId, method]
        );
      }

      await connection.query('COMMIT');

      const [modules] = await connection.execute(`
        SELECT 
          m.*,
          sp.id as system_prompt_id,
          sp.name as system_prompt_name,
          sp.content as system_prompt_content
        FROM modules m
        LEFT JOIN system_prompts sp ON m.system_prompt_id = sp.id
        WHERE m.id = ?
      `, [moduleId]);

      const [gradingMethods] = await connection.execute(
        'SELECT grading_method FROM module_grading_methods WHERE module_id = ?',
        [moduleId]
      );

      res.status(201).json({
        ...modules[0],
        grading_methods: gradingMethods.map(gm => gm.grading_method)
      });
    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating module:', error);
    res.status(500).json({ error: 'Failed to create module' });
  }
});

// POST /:id/test-cases - Create a test case for a module
router.post('/:id/test-cases', async (req, res) => {
  try {
    const moduleId = req.params.id;
    const { input, reference_response, system_prompt_id } = req.body;
    const connection = await getConnection();
    
    await connection.query('START TRANSACTION');
    
    try {
      const [result] = await connection.execute(
        'INSERT INTO test_cases (module_id, input, reference_response, system_prompt_id) VALUES (?, ?, ?, ?)',
        [moduleId, input, reference_response, system_prompt_id]
      );

      const [testCases] = await connection.execute(`
        SELECT tc.*, sp.content as system_prompt_content 
        FROM test_cases tc
        LEFT JOIN system_prompts sp ON tc.system_prompt_id = sp.id
        WHERE tc.id = ?
      `, [result.insertId]);

      await connection.query('COMMIT');
      res.status(201).json(testCases[0]);
    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating test case:', error);
    res.status(500).json({ error: 'Failed to create test case', details: error.message });
  }
});

// GET /:id/test-cases - Get test cases for a module
router.get('/:id/test-cases', async (req, res) => {
  try {
    const moduleId = req.params.id;
    const connection = await getConnection();

    const [testCases] = await connection.execute(`
      SELECT tc.id, tc.input, tc.reference_response, tc.system_prompt_id,
             sp.name as system_prompt_name
      FROM test_cases tc
      LEFT JOIN system_prompts sp ON tc.system_prompt_id = sp.id
      WHERE tc.module_id = ?
    `, [moduleId]);

    res.json(testCases);
  } catch (error) {
    console.error('Error fetching test cases:', error);
    res.status(500).json({ error: 'Failed to fetch test cases' });
  }
});

// DELETE /:moduleId/test-cases/:testCaseId - Remove a test case from a module
router.delete('/:moduleId/test-cases/:testCaseId', async (req, res) => {
  try {
    const connection = await getConnection();
    await connection.execute(
      'DELETE FROM test_cases WHERE id = ? AND module_id = ?',
      [req.params.testCaseId, req.params.moduleId]
    );
    res.status(204).send();
  } catch (error) {
    console.error('Error removing test case:', error);
    res.status(500).json({ error: 'Failed to remove test case' });
  }
});

// DELETE /:id - Delete a module and its associated test cases
router.delete('/:id', async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    await connection.query('START TRANSACTION');

    const [result] = await connection.execute(
      'DELETE FROM modules WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      await connection.query('ROLLBACK');
      return res.status(404).json({ error: 'Module not found' });
    }

    await connection.query('COMMIT');
    res.status(204).send();
  } catch (error) {
    if (connection) {
      await connection.query('ROLLBACK');
    }
    console.error('Error deleting module:', error);
    res.status(500).json({ error: 'Failed to delete module' });
  }
});

// POST /:id/run-tests - Run tests for a module or specific test case
router.post('/:id/run-tests', authenticateToken, async (req, res) => {
  const moduleId = req.params.id;
  const { testCaseIds, implementation, model } = req.body;
  let connection;

  try {
    connection = await getConnection();
    await connection.query('START TRANSACTION');

    const [modules] = await connection.execute(`
      SELECT m.*, sp.content as system_prompt_content, sp.id as system_prompt_id
      FROM modules m
      LEFT JOIN system_prompts sp ON m.system_prompt_id = sp.id
      WHERE m.id = ?
    `, [moduleId]);

    if (modules.length === 0) {
      throw new Error('Module not found');
    }

    const module = modules[0];
    const [gradingMethods] = await connection.execute(
      'SELECT grading_method FROM module_grading_methods WHERE module_id = ?',
      [moduleId]
    );

    let testCases;
    if (testCaseIds && testCaseIds.length > 0) {
      const placeholders = testCaseIds.map(() => '?').join(',');
      const [rows] = await connection.execute(
        `SELECT tc.id, tc.input as prompt, tc.reference_response as expected_response,
                tc.system_prompt_id, sp.content as system_prompt_content
         FROM test_cases tc
         LEFT JOIN system_prompts sp ON tc.system_prompt_id = sp.id
         WHERE tc.module_id = ? AND tc.id IN (${placeholders})`,
        [moduleId, ...testCaseIds]
      );
      testCases = rows;
    } else {
      const [rows] = await connection.execute(
        `SELECT tc.id, tc.input as prompt, tc.reference_response as expected_response,
                tc.system_prompt_id, sp.content as system_prompt_content
         FROM test_cases tc
         LEFT JOIN system_prompts sp ON tc.system_prompt_id = sp.id
         WHERE tc.module_id = ?`,
        [moduleId]
      );
      testCases = rows;
    }

    const testRunIds = [];
    for (const testCase of testCases) {
      for (const { grading_method } of gradingMethods) {
        const [result] = await connection.execute(
          `INSERT INTO test_runs (test_case_id, grading_method, status) VALUES (?, ?, 'pending')`,
          [testCase.id, grading_method]
        );
        testRunIds.push(result.insertId);
      }
    }

    const [models] = await connection.execute(
      'SELECT id FROM models WHERE name = ?',
      [implementation]
    );

    if (models.length === 0) {
      throw new Error(`Model implementation ${implementation} not found`);
    }

    const modelId = models[0].id;
    const [apiKeys] = await connection.execute(
      'SELECT encrypted_key, iv FROM model_api_keys WHERE model_id = ?',
      [modelId]
    );

    if (apiKeys.length === 0 || !apiKeys[0].encrypted_key) {
      throw new Error(`No API key found for ${implementation}`);
    }

    const decryptedKey = await decrypt(apiKeys[0].iv + ':' + apiKeys[0].encrypted_key);

    await connection.query('COMMIT');
    res.json({
      success: true,
      message: 'Tests queued successfully',
      testRunIds
    });

    for (const runId of testRunIds) {
      await connection.execute(
        'UPDATE test_runs SET status = ? WHERE id = ?',
        ['running', runId]
      );
    }

    const pythonInput = {
      test_cases: testCases.map(tc => ({
        id: tc.id,
        prompt: tc.prompt,
        expected_response: tc.expected_response,
        system_prompt: tc.system_prompt_content || module.system_prompt_content || null
      })),
      model_implementation: implementation,
      specific_model: model,
      api_key: decryptedKey,
      grading_methods: gradingMethods.map(gm => gm.grading_method)
    };

    const isWindows = process.platform === 'win32';
    const pythonPath = isWindows ? 
      path.join(process.cwd(), 'llm_evaluation', '.venv', 'Scripts', 'python.exe') :
      path.join(process.cwd(), 'llm_evaluation', '.venv', 'bin', 'python');

    const scriptPath = path.join(process.cwd(), 'llm_evaluation', 'run_tests.py');

    const pythonProcess = spawn(pythonPath, [scriptPath], {
      cwd: path.join(process.cwd(), 'llm_evaluation')
    });

    pythonProcess.stdin.write(JSON.stringify(pythonInput));
    pythonProcess.stdin.end();

    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    pythonProcess.on('close', async (code) => {
      try {
        if (code === 0) {
          const results = JSON.parse(outputData);
          
          if (!results.success) {
            throw new Error(results.error || 'Failed to run tests');
          }

          for (const result of results.results) {
            for (const [method, evaluation] of Object.entries(result.evaluation_result)) {
              await connection.execute(
                'UPDATE test_runs SET status = ? WHERE test_case_id = ? AND grading_method = ?',
                ['completed', result.test_case_id, method]
              );

              if (method === "LLM_JUDGE") {
                await connection.execute(
                  `INSERT INTO test_results 
                   (test_case_id, module_id, model_implementation, model_name, 
                    prompt, model_response, reference_response, grading_method, 
                    overall_score, attribute_scores, system_prompt_id, system_prompt_content) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    result.test_case_id,
                    moduleId,
                    implementation,
                    model,
                    result.prompt,
                    result.model_response,
                    result.expected_response,
                    method,
                    evaluation.score,
                    JSON.stringify({
                      attributes: evaluation.details.attributes,
                      responses: evaluation.details.responses
                    }),
                    module.system_prompt_id || null,
                    module.system_prompt_content || null
                  ]
                );
              } else {
                await connection.execute(
                  `INSERT INTO test_results 
                   (test_case_id, module_id, model_implementation, model_name, 
                    prompt, model_response, reference_response, grading_method, 
                    overall_score, attribute_scores, system_prompt_id, system_prompt_content) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    result.test_case_id,
                    moduleId,
                    implementation,
                    model,
                    result.prompt,
                    result.model_response,
                    result.expected_response,
                    method,
                    evaluation.score,
                    JSON.stringify(evaluation.details),
                    module.system_prompt_id || null,
                    module.system_prompt_content || null
                  ]
                );
              }
            }
          }
        } else {
          for (const runId of testRunIds) {
            await connection.execute(
              'UPDATE test_runs SET status = ? WHERE id = ?',
              ['failed', runId]
            );
          }
        }
      } catch (error) {
        console.error('Error processing test results:', error);
        for (const runId of testRunIds) {
          await connection.execute(
            'UPDATE test_runs SET status = ? WHERE id = ?',
            ['failed', runId]
          );
        }
      }
    });

  } catch (error) {
    if (connection) {
      await connection.query('ROLLBACK');
    }
    console.error('Error running tests:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to run tests'
    });
  }
});

// PUT /:id - Update a module
router.put('/:id', async (req, res) => {
  try {
    const { name, description, purpose, relevance, grading_methods, system_prompt_id } = req.body;
    const moduleId = req.params.id;
    const connection = await getConnection();

    await connection.beginTransaction();

    try {
      await connection.execute(
        'UPDATE modules SET name = ?, description = ?, purpose = ?, relevance = ?, system_prompt_id = ? WHERE id = ?',
        [name, description, purpose, relevance, system_prompt_id || null, moduleId]
      );

      await connection.execute(
        'DELETE FROM module_grading_methods WHERE module_id = ?',
        [moduleId]
      );

      for (const method of grading_methods) {
        await connection.execute(
          'INSERT INTO module_grading_methods (module_id, grading_method) VALUES (?, ?)',
          [moduleId, method]
        );
      }

      await connection.commit();

      const [modules] = await connection.execute(`
        SELECT 
          m.*,
          sp.id as system_prompt_id,
          sp.name as system_prompt_name,
          sp.content as system_prompt_content
        FROM modules m
        LEFT JOIN system_prompts sp ON m.system_prompt_id = sp.id
        WHERE m.id = ?
      `, [moduleId]);

      const [gradingMethods] = await connection.execute(
        'SELECT grading_method FROM module_grading_methods WHERE module_id = ?',
        [moduleId]
      );

      if (modules.length === 0) {
        return res.status(404).json({ error: 'Module not found' });
      }

      res.json({
        ...modules[0],
        grading_methods: gradingMethods.map(gm => gm.grading_method)
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error updating module:', error);
    res.status(500).json({ error: 'Failed to update module' });
  }
});

export default router; 