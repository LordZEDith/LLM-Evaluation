import React, { useState, useEffect } from 'react';
import { getResults } from '../../api';

export function Results() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState(null);
  const [expandedModules, setExpandedModules] = useState(new Set());
  const [expandedTestCases, setExpandedTestCases] = useState(new Set());
  const [expandedGradingMethods, setExpandedGradingMethods] = useState(new Set());
  const [selectedResult, setSelectedResult] = useState(null);

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      const data = await getResults();
      //console.log('Fetched results:', data);
      setResults(data);
    } catch (error) {
      //console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleModuleExpansion = (moduleKey) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleKey)) {
      newExpanded.delete(moduleKey);
    } else {
      newExpanded.add(moduleKey);
    }
    setExpandedModules(newExpanded);
  };

  const toggleTestCaseExpansion = (testCaseKey) => {
    const newExpanded = new Set(expandedTestCases);
    if (newExpanded.has(testCaseKey)) {
      newExpanded.delete(testCaseKey);
    } else {
      newExpanded.add(testCaseKey);
    }
    setExpandedTestCases(newExpanded);
  };

  const toggleGradingMethodExpansion = (methodKey) => {
    const newExpanded = new Set(expandedGradingMethods);
    if (newExpanded.has(methodKey)) {
      newExpanded.delete(methodKey);
    } else {
      newExpanded.add(methodKey);
    }
    setExpandedGradingMethods(newExpanded);
  };

  const formatScore = (score) => {
    const numScore = typeof score === 'string' ? parseFloat(score) : score;
    if (numScore !== null && numScore !== undefined && !isNaN(numScore)) {
      return numScore.toFixed(2);
    }
    return 'N/A';
  };

  const calculateAverageScore = (moduleResults) => {
    const scores = moduleResults.map(result => {
      if (result.grading_method === 'ROUGE') {
        try {
          const attrScores = typeof result.attribute_scores === 'string'
            ? JSON.parse(result.attribute_scores)
            : result.attribute_scores;
          
          if (attrScores) {
            const { rouge1, rouge2, rougeL } = attrScores;
            return (rouge1.fmeasure + rouge2.fmeasure + rougeL.fmeasure) / 3;
          }
        } catch (e) {
          console.error('Error parsing ROUGE scores:', e);
          return null;
        }
      }
      return parseFloat(result.overall_score);
    }).filter(score => score !== null && !isNaN(score));
    
    if (scores.length === 0) return 'N/A';
    
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    return formatScore(average);
  };

  const groupedResults = results.reduce((acc, result) => {
    const key = `${result.model_implementation}-${result.model_name}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(result);
    return acc;
  }, {});

  if (loading) {
    return <div className="p-6 dark:text-gray-300">Loading...</div>;
  }

  const getScoreColor = (score) => {
    const numScore = parseFloat(score);
    if (numScore > 0.70) return 'text-green-600 dark:text-green-400';
    if (numScore >= 0.51) return 'text-orange-500 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const renderGradingMethodDetails = (method, evaluation) => {
    switch (method) {
      case 'ROUGE':
        return (
          <div className="space-y-4">
            {Object.entries(evaluation.details).filter(([key]) => key !== 'method').map(([type, scores]) => (
              <div key={type} className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <h3 className="font-medium mb-2 dark:text-white">{type.toUpperCase()}</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="font-medium dark:text-gray-200">Precision</p>
                    <p className={getScoreColor(scores.precision)}>{scores.precision.toFixed(3)}</p>
                  </div>
                  <div>
                    <p className="font-medium dark:text-gray-200">Recall</p>
                    <p className={getScoreColor(scores.recall)}>{scores.recall.toFixed(3)}</p>
                  </div>
                  <div>
                    <p className="font-medium dark:text-gray-200">F-measure</p>
                    <p className={getScoreColor(scores.fmeasure)}>{scores.fmeasure.toFixed(3)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      case 'BLEU':
      case 'METEOR':
        return (
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded space-y-3">
            <div className="font-medium dark:text-gray-200">
              Score: <span className={getScoreColor(evaluation.score)}>{evaluation.score}</span>
            </div>
            <div>
              <div className="font-medium mb-2 dark:text-gray-200">Token Comparison:</div>
              <div className="space-y-1 font-mono text-sm dark:text-gray-300">
                <div>Reference: [{evaluation.details.reference_tokens.map(token => `'${token}'`).join(', ')}]</div>
                <div>Response:  [{evaluation.details.response_tokens.map(token => `'${token}'`).join(', ')}]</div>
              </div>
            </div>
          </div>
        );
      case 'LLM_JUDGE':
        const attributes = Object.entries(evaluation.details.attributes);
        const regularAttributes = attributes.filter(([attr]) => attr.toLowerCase() !== 'creativity');
        const creativityAttribute = attributes.find(([attr]) => attr.toLowerCase() === 'creativity');
        
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {regularAttributes.map(([attr, data]) => {
                const score = parseFloat(data.score);
                
                return (
                  <div key={attr} className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900 dark:text-white">{attr.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
                      <span className={`font-medium ${getScoreColor(score)}`}>
                        {score.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{data.explanation}</p>
                  </div>
                );
              })}
            </div>
            
            {creativityAttribute && (
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900 dark:text-white">Creativity</h3>
                  <span className={`font-medium ${getScoreColor(creativityAttribute[1].score)}`}>
                    {parseFloat(creativityAttribute[1].score).toFixed(2)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">{creativityAttribute[1].explanation}</p>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 dark:text-white">Results</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Models List - Left Column */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4">
              <h2 className="text-xl font-semibold mb-4 dark:text-white">Models</h2>
              <div className="space-y-2">
                {Object.entries(groupedResults).map(([modelKey, modelResults]) => {
                  const [implementation, ...nameParts] = modelKey.split('-');
                  const name = nameParts.join('-');
                  const averageScore = calculateAverageScore(modelResults);
                  
                  return (
                    <button
                      key={modelKey}
                      onClick={() => setSelectedModel(selectedModel === modelKey ? null : modelKey)}
                      className={`w-full text-left p-3 rounded hover:bg-gray-50 dark:hover:bg-gray-700 border ${
                        selectedModel === modelKey ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="font-medium dark:text-white">{name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{implementation}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {modelResults.length} test results • Avg: <span className={getScoreColor(averageScore)}>{averageScore}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Results Details - Right Column */}
        <div className="lg:col-span-2">
          {selectedModel ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              {(() => {
                const moduleGroups = groupedResults[selectedModel].reduce((acc, result) => {
                  const key = `${result.module_id}-${result.module_name}`;
                  if (!acc[key]) {
                    acc[key] = [];
                  }
                  acc[key].push(result);
                  return acc;
                }, {});

                return Object.entries(moduleGroups).map(([moduleKey, moduleResults]) => {
                  const testCaseGroups = moduleResults.reduce((acc, result) => {
                    const key = result.test_case_id;
                    if (!acc[key]) {
                      acc[key] = [];
                    }
                    acc[key].push(result);
                    return acc;
                  }, {});

                  return (
                    <div key={moduleKey} className="border-b dark:border-gray-700 last:border-b-0">
                      {/* Module Header */}
                      <div
                        className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 flex justify-between items-center"
                        onClick={() => toggleModuleExpansion(moduleKey)}
                      >
                        <div>
                          <h3 className="text-lg font-medium dark:text-white">
                            {moduleResults[0].module_name}
                          </h3>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Average Score: <span className={getScoreColor(calculateAverageScore(moduleResults))}>{calculateAverageScore(moduleResults)}</span>
                          </div>
                        </div>
                        <span className="text-gray-400">
                          {expandedModules.has(moduleKey) ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                        </span>
                      </div>

                      {/* Test Cases */}
                      {expandedModules.has(moduleKey) && (
                        <div className="px-4 pb-4">
                          {Object.entries(testCaseGroups)
                            .sort(([idA], [idB]) => parseInt(idA) - parseInt(idB))
                            .map(([testCaseId, testCaseResults], index) => {
                              const testCaseKey = `${moduleKey}-${testCaseId}`;
                              const averageTestCaseScore = calculateAverageScore(testCaseResults);

                              return (
                                <div key={testCaseKey} className="mb-4 last:mb-0">
                                  {/* Test Case Header */}
                                  <div
                                    className="bg-gray-50 dark:bg-gray-700 p-3 rounded cursor-pointer"
                                    onClick={() => toggleTestCaseExpansion(testCaseKey)}
                                  >
                                    <div className="flex justify-between items-center">
                                      <div>
                                        <div className="font-medium dark:text-white">Test Case #{index + 1}</div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                          Average Score: <span className={getScoreColor(averageTestCaseScore)}>{averageTestCaseScore}</span>
                                        </div>
                                      </div>
                                      <span className="text-gray-400">
                                        {expandedTestCases.has(testCaseKey) ? (
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                          </svg>
                                        ) : (
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                          </svg>
                                        )}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Test Cases */}
                                  {expandedTestCases.has(testCaseKey) && (
                                    <div className="mt-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 shadow-sm">
                                      {/* Display prompt, responses, and system prompt */}
                                      <div className="p-4 space-y-4">
                                        {testCaseResults[0].system_prompt_content && (
                                          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                                            <div className="font-medium mb-1 dark:text-white">System Prompt:</div>
                                            <div className="text-sm whitespace-pre-wrap dark:text-gray-300">
                                              {testCaseResults[0].system_prompt_content}
                                            </div>
                                          </div>
                                        )}
                                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                                          <div className="font-medium mb-1 dark:text-white">Input:</div>
                                          <div className="text-sm whitespace-pre-wrap dark:text-gray-300">
                                            {testCaseResults[0].prompt}
                                          </div>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                                          <div className="font-medium mb-1 dark:text-white">LLM Response:</div>
                                          <div className="text-sm whitespace-pre-wrap dark:text-gray-300">
                                            {testCaseResults[0].model_response}
                                          </div>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                                          <div className="font-medium mb-1 dark:text-white">Reference Response:</div>
                                          <div className="text-sm whitespace-pre-wrap dark:text-gray-300">
                                            {testCaseResults[0].reference_response}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Grading Methods */}
                                      <div className="p-4 space-y-2">
                                        {/* Fixed set of grading methods */}
                                        {['ROUGE', 'BLEU', 'METEOR', 'LLM_JUDGE']
                                          .map(methodName => {
                                            const resultWithMethod = testCaseResults.find(result => {
                                              if (methodName === 'LLM_JUDGE') {
                                                return result.grading_method === 'LLM_JUDGE' || 
                                                       (result.attribute_scores && result.attribute_scores.includes('attributes'));
                                              }
                                              return result.grading_method === methodName;
                                            });

                                            let evaluationData = null;
                                            if (resultWithMethod) {
                                              if (methodName === 'LLM_JUDGE') {
                                                try {
                                                  const attrScores = typeof resultWithMethod.attribute_scores === 'string'
                                                    ? JSON.parse(resultWithMethod.attribute_scores)
                                                    : resultWithMethod.attribute_scores;
                                                  
                                                  if (attrScores.attributes) {
                                                    evaluationData = {
                                                      score: resultWithMethod.overall_score,
                                                      details: attrScores
                                                    };
                                                  }
                                                } catch (e) {
                                                  console.error('Error parsing LLM_JUDGE scores:', e);
                                                }
                                              } else if (methodName === 'ROUGE') {
                                                try {
                                                  const attrScores = typeof resultWithMethod.attribute_scores === 'string'
                                                    ? JSON.parse(resultWithMethod.attribute_scores)
                                                    : resultWithMethod.attribute_scores;
                                                  
                                                  if (attrScores) {
                                                    const { rouge1, rouge2, rougeL } = attrScores;
                                                    const averageScore = (
                                                      rouge1.fmeasure + 
                                                      rouge2.fmeasure + 
                                                      rougeL.fmeasure
                                                    ) / 3;
                                                    
                                                    evaluationData = {
                                                      score: averageScore.toFixed(2),
                                                      details: {
                                                        rouge1,
                                                        rouge2,
                                                        rougeL
                                                      }
                                                    };
                                                  }
                                                } catch (e) {
                                                  console.error('Error parsing ROUGE scores:', e);
                                                }
                                              } else if (methodName === 'METEOR' || methodName === 'BLEU') {
                                                try {
                                                  const attrScores = typeof resultWithMethod.attribute_scores === 'string'
                                                    ? JSON.parse(resultWithMethod.attribute_scores)
                                                    : resultWithMethod.attribute_scores;
                                                  
                                                  evaluationData = {
                                                    score: resultWithMethod.overall_score,
                                                    details: attrScores
                                                  };
                                                } catch (e) {
                                                  console.error(`Error parsing ${methodName} scores:`, e);
                                                }
                                              }
                                            }

                                            if (!evaluationData) return null;

                                            const methodKey = `${testCaseKey}-${methodName}`;
                                            
                                            return (
                                              <div key={methodKey} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-sm text-sm">
                                                <div
                                                  className="p-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                                                  onClick={() => toggleGradingMethodExpansion(methodKey)}
                                                >
                                                  <div className="flex justify-between items-center">
                                                    <div>
                                                      <div className="font-medium text-gray-900 dark:text-white">
                                                        {methodName === 'LLM_JUDGE' ? 'LLM JUDGE' : methodName}
                                                      </div>
                                                      <div className="text-gray-600 dark:text-gray-400">
                                                        {methodName === 'ROUGE' || methodName === 'LLM_JUDGE' ? 'Average Score: ' : 'Score: '}
                                                        <span className={getScoreColor(evaluationData.score)}>
                                                          {evaluationData.score}
                                                        </span>
                                                      </div>
                                                    </div>
                                                    <span className="text-gray-400">
                                                      {expandedGradingMethods.has(methodKey) ? (
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                      ) : (
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                        </svg>
                                                      )}
                                                    </span>
                                                  </div>
                                                </div>

                                                {expandedGradingMethods.has(methodKey) && (
                                                  <div className="border-t dark:border-gray-700 p-3 bg-white dark:bg-gray-800 rounded-b">
                                                    {renderGradingMethodDetails(methodName, evaluationData)}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })
                                          .filter(Boolean)} {/* Filter out null values */}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-gray-500 dark:text-gray-400">
              Select a model to view test results
            </div>
          )}
        </div>
      </div>

      {/* Result Details Modal */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full">
            <h2 className="text-xl font-bold mb-4 dark:text-white">
              {selectedResult.method} Evaluation Details
            </h2>
            <div className="space-y-4">
              {renderGradingMethodDetails(selectedResult.method, selectedResult)}
              <div className="flex justify-end">
                <button
                  onClick={() => setSelectedResult(null)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 