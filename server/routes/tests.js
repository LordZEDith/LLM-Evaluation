const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const db = require('../config/database');

// Run all tests
router.post('/run', async (req, res) => {
    try {
        const { testCases, modelImplementation, specificModel, apiKey } = req.body;
        
        const pythonProcess = spawn('python', [
            path.join(__dirname, '../../llm_evaluation/run_tests.py')
        ]);
        
        pythonProcess.stdin.write(JSON.stringify({
            test_cases: testCases,
            model_implementation: modelImplementation,
            specific_model: specificModel,
            api_key: apiKey
        }));
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
            if (code !== 0) {
                return res.status(500).json({
                    success: false,
                    error: errorData || 'Test execution failed'
                });
            }
            
            try {
                const results = JSON.parse(outputData);
                
                // Store results in database
                const timestamp = new Date().toISOString();
                for (const result of results.results) {
                    await db.query(
                        `INSERT INTO test_results 
                        (test_case_id, model_implementation, specific_model, 
                         prompt, model_response, expected_response, 
                         evaluation_result, error, timestamp)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            result.test_case_id,
                            modelImplementation,
                            specificModel,
                            result.prompt,
                            result.model_response,
                            result.expected_response,
                            JSON.stringify(result.evaluation_result),
                            result.error,
                            timestamp
                        ]
                    );
                }
                
                res.json(results);
                
            } catch (err) {
                res.status(500).json({
                    success: false,
                    error: 'Failed to process test results'
                });
            }
        });
        
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Get test results
router.get('/results', async (req, res) => {
    try {
        const results = await db.query(
            `SELECT * FROM test_results 
             ORDER BY timestamp DESC 
             LIMIT 100`
        );
        
        res.json({
            success: true,
            results: results
        });
        
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

module.exports = router; 