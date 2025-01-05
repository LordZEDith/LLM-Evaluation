import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  getModules, 
  createModule, 
  getGradingMethods,
  getModuleDetails,
  deleteModule,
  runTests,
  cancelTest as apiCancelTest,
  getSystemPrompts
} from '../../api';
import { MultiSelect } from '../ui/multi-select';
import { ModelSelectionDialog } from './ModelSelectionDialog';

export function TestCases() {
  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [isCreatingModule, setIsCreatingModule] = useState(false);
  const [isAddingTestCase, setIsAddingTestCase] = useState(false);
  const [runningTests, setRunningTests] = useState(new Set());
  const [testCaseToDelete, setTestCaseToDelete] = useState(null);
  const [moduleToDelete, setModuleToDelete] = useState(null);
  const [selectedResult, setSelectedResult] = useState(null);
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false);
  const [pendingTestRun, setPendingTestRun] = useState(null);
  
  const [newModule, setNewModule] = useState({
    name: '',
    description: '',
    purpose: '',
    relevance: '',
    grading_methods: [],
    system_prompt_id: null
  });

  const [newTestCase, setNewTestCase] = useState({
    input: '',
    reference_response: ''
  });

  const [gradingMethods, setGradingMethods] = useState([]);
  const [systemPrompts, setSystemPrompts] = useState([]);

  useEffect(() => {
    fetchModules();
    fetchGradingMethods();
    fetchSystemPrompts();
  }, []);

  const fetchModules = async () => {
    try {
      const data = await getModules();
      setModules(data);
    } catch (error) {
      console.error('Error fetching modules:', error);
    }
  };

  const fetchGradingMethods = async () => {
    try {
      const methods = await getGradingMethods();
      setGradingMethods(methods.map(method => ({
        label: method === 'LLM_JUDGE' ? 'LLM JUDGE' : method,
        value: method
      })));
    } catch (error) {
      console.error('Error fetching grading methods:', error);
    }
  };

  const fetchSystemPrompts = async () => {
    try {
      const prompts = await getSystemPrompts();
      setSystemPrompts(prompts);
    } catch (error) {
      console.error('Error fetching system prompts:', error);
    }
  };

  const handleCreateModule = async (e) => {
    e.preventDefault();
    try {
      await createModule(newModule);
      setIsCreatingModule(false);
      setNewModule({
        name: '',
        description: '',
        purpose: '',
        relevance: '',
        grading_methods: [],
        system_prompt_id: null
      });
      fetchModules();
    } catch (error) {
      console.error('Error creating module:', error);
    }
  };

  const handleAddTestCase = async (e) => {
    e.preventDefault();
    try {
      console.log('Submitting test case with:', newTestCase);
      await axios.post(`/api/modules/${selectedModule.id}/test-cases`, {
        input: newTestCase.input,
        reference_response: newTestCase.reference_response,
        system_prompt_id: newTestCase.system_prompt_id || null
      });
      setIsAddingTestCase(false);
      setNewTestCase({ input: '', reference_response: '', system_prompt_id: null });
      fetchModuleDetails(selectedModule.id);
    } catch (error) {
      console.error('Error adding test case:', error);
    }
  };

  const handleRemoveTestCase = async (testCaseId) => {
    try {
      await axios.delete(`/api/modules/${selectedModule.id}/test-cases/${testCaseId}`);
      setTestCaseToDelete(null);
      fetchModuleDetails(selectedModule.id);
    } catch (error) {
      console.error('Error removing test case:', error);
    }
  };

  const fetchModuleDetails = async (moduleId) => {
    try {
      const data = await getModuleDetails(moduleId);
      setSelectedModule(data);
    } catch (error) {
      console.error('Error fetching module details:', error);
    }
  };

  const handleRunTests = async (moduleId, testCaseId = null) => {
    try {
      const module = await getModuleDetails(moduleId);
      
      if (module?.system_prompt_id && module?.system_prompt_content) {
        const useSystemPrompt = window.confirm('Would you like to use the system prompt for this test run?');
        setPendingTestRun({ 
          moduleId, 
          testCaseId,
          useSystemPrompt: useSystemPrompt
        });
      } else {
        setPendingTestRun({ 
          moduleId, 
          testCaseId,
          useSystemPrompt: false
        });
      }
      setIsModelDialogOpen(true);
    } catch (error) {
      console.error('Error checking for system prompt:', error);
      setPendingTestRun({ 
        moduleId, 
        testCaseId,
        useSystemPrompt: false
      });
      setIsModelDialogOpen(true);
    }
  };

  const handleModelSelect = async ({ implementation, model }) => {
    if (!pendingTestRun) return;

    const { moduleId, testCaseId, useSystemPrompt } = pendingTestRun;
    const testsToRun = testCaseId ? [testCaseId] : selectedModule.test_cases.map(tc => tc.id);
    setRunningTests(new Set([...runningTests, ...testsToRun]));

    try {
      const response = await runTests(moduleId, testsToRun, implementation, model, useSystemPrompt);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to start tests');
      }

      const pollInterval = setInterval(async () => {
        try {
          const updatedModule = await getModuleDetails(moduleId);
          setSelectedModule(updatedModule);
          
          const allComplete = testsToRun.every(testId => {
            const testCase = updatedModule.test_cases.find(tc => tc.id === testId);
            return testCase.results && testCase.results.length > 0;
          });

          if (allComplete) {
            setRunningTests(prevRunningTests => {
              const newRunningTests = new Set([...prevRunningTests]);
              testsToRun.forEach(id => newRunningTests.delete(id));
              return newRunningTests;
            });
            clearInterval(pollInterval);
          }
        } catch (error) {
          console.error('Error polling test status:', error);
        }
      }, 2000);
    } catch (error) {
      console.error('Error starting tests:', error);
      setRunningTests(new Set([...runningTests].filter(id => !testsToRun.includes(id))));
    } finally {
      setPendingTestRun(null);
    }
  };

  const handleCancelTest = async (testCaseId) => {
    try {
      await apiCancelTest(testCaseId);
      setRunningTests(new Set([...runningTests].filter(id => id !== testCaseId)));
    } catch (error) {
      console.error('Error canceling test:', error);
    }
  };

  const handleRemoveModule = async (moduleId) => {
    try {
      await deleteModule(moduleId);
      setModuleToDelete(null);
      if (selectedModule?.id === moduleId) {
        setSelectedModule(null);
      }
      fetchModules();
    } catch (error) {
      console.error('Error removing module:', error);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Evaluation</h1>
        <button
          onClick={() => setIsCreatingModule(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Create New Module
        </button>
      </div>

      {/* Module List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4 dark:text-white">Modules</h2>
            <div className="space-y-2">
              {modules.map(module => (
                <div key={module.id} className="flex items-center space-x-2">
                  <button
                    onClick={() => fetchModuleDetails(module.id)}
                    className={`flex-1 text-left p-3 rounded border ${
                      selectedModule?.id === module.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50 dark:border-blue-400'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                    } dark:text-white`}
                  >
                    {module.name}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setModuleToDelete(module);
                    }}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 rounded transition-colors"
                    title="Remove Module"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Module Details */}
        <div className="col-span-2">
          {selectedModule ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold mb-2 dark:text-white">{selectedModule.name}</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold dark:text-white">Description:</h3>
                    <p className="dark:text-gray-300">{selectedModule.description}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold dark:text-white">Purpose:</h3>
                    <p className="dark:text-gray-300">{selectedModule.purpose}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold dark:text-white">Relevance:</h3>
                    <p className="dark:text-gray-300">{selectedModule.relevance}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold dark:text-white">Grading Methods:</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedModule.grading_methods?.map((method) => (
                        <span key={method} className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
                          {method === 'LLM_JUDGE' ? 'LLM JUDGE' : method}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-4 flex justify-between items-center">
                <h3 className="text-lg font-semibold">Test Cases</h3>
                <div className="space-x-4">
                  <button
                    onClick={() => handleRunTests(selectedModule.id)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Run All Tests
                  </button>
                  <button
                    onClick={() => setIsAddingTestCase(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Add Test Case
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {selectedModule.test_cases?.map(testCase => (
                  <div key={testCase.id} className="border dark:border-gray-700 rounded p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium mb-2 dark:text-white">Input:</h4>
                        <p className="mb-4 whitespace-pre-wrap dark:text-gray-300">{testCase.input}</p>
                        <h4 className="font-medium mb-2 dark:text-white">Reference Response:</h4>
                        <p className="whitespace-pre-wrap dark:text-gray-300">{testCase.reference_response}</p>
                        {testCase.system_prompt_name && (
                          <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded text-sm">
                            <span className="font-medium">System Prompt:</span>
                            <span>{testCase.system_prompt_name}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        {runningTests.has(testCase.id) ? (
                          <button
                            onClick={() => handleCancelTest(testCase.id)}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          >
                            Cancel
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRunTests(selectedModule.id, testCase.id)}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                          >
                            Run
                          </button>
                        )}
                        <button
                          onClick={() => setTestCaseToDelete(testCase)}
                          className="px-3 py-1 text-red-600 border border-red-600 rounded hover:bg-red-50 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      {testCase.results?.map((result, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                          <div className="flex items-center space-x-4">
                            <span className="font-medium dark:text-white">
                              {result.method === 'LLM_JUDGE' ? 'LLM JUDGE' : result.method}:
                            </span>
                            <span className="text-lg dark:text-gray-300">
                              {result.score != null ? result.score.toFixed(2) : 'N/A'}
                            </span>
                          </div>
                          {result.method === 'LLM_JUDGE' && result.details && (
                            <button
                              onClick={() => setSelectedResult(result)}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
                            >
                              View Details
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-gray-500 dark:text-gray-400">
              Select a module to view its details and test cases
            </div>
          )}
        </div>
      </div>

      {/* Create Module Modal */}
      {isCreatingModule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full">
            <h2 className="text-xl font-bold mb-4 dark:text-white">Create New Module</h2>
            <form onSubmit={handleCreateModule} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                <input
                  type="text"
                  value={newModule.name}
                  onChange={(e) => setNewModule(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                <textarea
                  value={newModule.description}
                  onChange={(e) => setNewModule(prev => ({ ...prev, description: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  rows="3"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Purpose</label>
                <textarea
                  value={newModule.purpose}
                  onChange={(e) => setNewModule(prev => ({ ...prev, purpose: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  rows="3"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Relevance</label>
                <textarea
                  value={newModule.relevance}
                  onChange={(e) => setNewModule(prev => ({ ...prev, relevance: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  rows="3"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Grading Methods</label>
                <MultiSelect
                  options={gradingMethods}
                  value={newModule.grading_methods}
                  onChange={(selected) => setNewModule(prev => ({ ...prev, grading_methods: selected }))}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">System Prompt (Optional)</label>
                <select
                  value={newModule.system_prompt_id || ''}
                  onChange={(e) => setNewModule(prev => ({ ...prev, system_prompt_id: e.target.value ? Number(e.target.value) : null }))}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">No system prompt</option>
                  {systemPrompts.map(prompt => (
                    <option key={prompt.id} value={prompt.id}>
                      {prompt.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setIsCreatingModule(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Test Case Modal */}
      {isAddingTestCase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full">
            <h2 className="text-xl font-bold mb-4 dark:text-white">Add Test Case</h2>
            <form onSubmit={handleAddTestCase} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Input</label>
                <textarea
                  value={newTestCase.input}
                  onChange={(e) => setNewTestCase(prev => ({ ...prev, input: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  rows="3"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reference Response</label>
                <textarea
                  value={newTestCase.reference_response}
                  onChange={(e) => setNewTestCase(prev => ({ ...prev, reference_response: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  rows="3"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">System Prompt (Optional)</label>
                <select
                  value={newTestCase.system_prompt_id || ''}
                  onChange={(e) => setNewTestCase(prev => ({ ...prev, system_prompt_id: e.target.value ? Number(e.target.value) : null }))}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">No system prompt</option>
                  {systemPrompts.map(prompt => (
                    <option key={prompt.id} value={prompt.id}>
                      {prompt.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingTestCase(false);
                    setNewTestCase({ input: '', reference_response: '', system_prompt_id: null });
                  }}
                  className="px-4 py-2 border rounded hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Add Test Case
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Test Case Confirmation Modal */}
      {testCaseToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4 dark:text-white">Delete Test Case</h2>
            <p className="mb-6 dark:text-gray-300">Are you sure you want to delete this test case? This action cannot be undone.</p>
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded">
                <h4 className="font-medium mb-2 dark:text-white">Input:</h4>
                <p className="text-sm mb-4 whitespace-pre-wrap dark:text-gray-300">{testCaseToDelete.input}</p>
                <h4 className="font-medium mb-2 dark:text-white">Reference Response:</h4>
                <p className="text-sm whitespace-pre-wrap dark:text-gray-300">{testCaseToDelete.reference_response}</p>
              </div>
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setTestCaseToDelete(null)}
                  className="px-4 py-2 border dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveTestCase(testCaseToDelete.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Module Confirmation Modal */}
      {moduleToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4 dark:text-white">Delete Module</h2>
            <p className="mb-6 dark:text-gray-300">Are you sure you want to delete this module? This will also delete all associated test cases. This action cannot be undone.</p>
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded">
                <h4 className="font-medium mb-2 dark:text-white">Module Name:</h4>
                <p className="text-sm mb-4 dark:text-gray-300">{moduleToDelete.name}</p>
                <h4 className="font-medium mb-2 dark:text-white">Description:</h4>
                <p className="text-sm dark:text-gray-300">{moduleToDelete.description}</p>
              </div>
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setModuleToDelete(null)}
                  className="px-4 py-2 border dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveModule(moduleToDelete.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Result Details Modal */}
      {selectedResult && selectedResult.details && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full">
            <h2 className="text-xl font-bold mb-4 dark:text-white">
              {selectedResult.method === 'LLM_JUDGE' ? 'LLM JUDGE' : selectedResult.method} Evaluation Details
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded">
                  <h3 className="font-medium mb-1">Accuracy</h3>
                  <p className="text-lg">{selectedResult.details.accuracy?.toFixed(2) ?? 'N/A'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <h3 className="font-medium mb-1">Relevance</h3>
                  <p className="text-lg">{selectedResult.details.relevance?.toFixed(2) ?? 'N/A'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <h3 className="font-medium mb-1">Coherence</h3>
                  <p className="text-lg">{selectedResult.details.coherence?.toFixed(2) ?? 'N/A'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <h3 className="font-medium mb-1">Context Adherence</h3>
                  <p className="text-lg">{selectedResult.details.context_adherence?.toFixed(2) ?? 'N/A'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <h3 className="font-medium mb-1">Ethical Considerations</h3>
                  <p className="text-lg">{selectedResult.details.ethical_considerations?.toFixed(2) ?? 'N/A'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <h3 className="font-medium mb-1">Professionalism</h3>
                  <p className="text-lg">{selectedResult.details.professionalism?.toFixed(2) ?? 'N/A'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <h3 className="font-medium mb-1">Reasoning</h3>
                  <p className="text-lg">{selectedResult.details.reasoning?.toFixed(2) ?? 'N/A'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <h3 className="font-medium mb-1">Creativity</h3>
                  <p className="text-lg">{selectedResult.details.creativity?.toFixed(2) ?? 'N/A'}</p>
                </div>
              </div>
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

      {/* Add ModelSelectionDialog */}
      <ModelSelectionDialog
        isOpen={isModelDialogOpen}
        onClose={() => {
          setIsModelDialogOpen(false);
          setPendingTestRun(null);
        }}
        onSelect={handleModelSelect}
      />
    </div>
  );
} 