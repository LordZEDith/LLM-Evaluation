import { useState, useEffect } from 'react';
import axios from 'axios';

const api = axios.create({
  baseURL: '/api'
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function Runs() {
  const [activeRuns, setActiveRuns] = useState([]);
  const [completedRuns, setCompletedRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRuns();
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchRuns, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchRuns = async () => {
    try {
      const response = await api.get('/test-runs');
      setActiveRuns(response.data.activeRuns);
      setCompletedRuns(response.data.completedRuns);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching runs:', error);
      if (error.response?.status === 401) {
        // Handle unauthorized error (e.g., redirect to login)
        window.location.href = '/login';
      }
    }
  };

  const handleCancel = async (runId) => {
    try {
      await api.post(`/test-runs/${runId}/cancel`);
      fetchRuns(); // Refresh the list
    } catch (error) {
      console.error('Error canceling run:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200';
      case 'running':
        return 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200';
      case 'completed':
        return 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200';
      case 'failed':
        return 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Loading runs...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold dark:text-white">Runs</h1>
        <p className="text-gray-600 dark:text-gray-400">Monitor and manage your runs</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active Runs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">Active Runs</h2>
          <div className="space-y-4">
            {activeRuns.map(run => (
              <div key={run.id} className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded-full text-sm ${getStatusColor(run.status)}`}>
                        {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                      </span>
                      <span className="text-gray-600 dark:text-gray-300">
                        Test Case #{run.test_case_id} - {run.module_name || 'Unknown Module'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium dark:text-gray-300">Method:</span> {run.grading_method === 'LLM_JUDGE' ? 'LLM JUDGE' : run.grading_method}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium dark:text-gray-300">Started:</span> {new Date(run.created_at).toLocaleString()}
                    </div>
                  </div>
                  {run.status !== 'completed' && (
                    <button
                      onClick={() => handleCancel(run.id)}
                      className="px-3 py-1 text-red-600 dark:text-red-400 border border-red-600 dark:border-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
            {activeRuns.length === 0 && (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">No active runs</p>
            )}
          </div>
        </div>

        {/* Completed Runs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">Completed Runs</h2>
          <div className="space-y-4">
            {completedRuns.map((run, index) => (
              <div key={index} className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-1 rounded-full text-sm ${getStatusColor(run.status)}`}>
                    {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                  </span>
                  <span className="text-gray-600 dark:text-gray-300 font-medium">
                    {run.module_name || 'Unknown Module'}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium dark:text-gray-300">Test Cases:</span> {run.test_case_count}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium dark:text-gray-300">Methods:</span> {run.grading_methods.map(method => 
                    method === 'LLM_JUDGE' ? 'LLM JUDGE' : method
                  ).join(', ')}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium dark:text-gray-300">Completed:</span> {new Date(run.updated_at).toLocaleString()}
                </div>
              </div>
            ))}
            {completedRuns.length === 0 && (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">No completed runs</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 