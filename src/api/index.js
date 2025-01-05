import axios from 'axios';

const api = axios.create({
  baseURL: '/api'
});

// Adds auth token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handles auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Dashboard
export const getDashboardStats = async () => {
  const response = await api.get('/dashboard/stats');
  return response.data;
};

// Models
export const getModels = async () => {
  try {
    const response = await api.get('/models/config');
    const data = response.data;
    
    if (!Array.isArray(data)) {
      console.error('Invalid models data format:', data);
      return [];
    }

    const validModels = data.filter(model => (
      model && 
      typeof model === 'object' && 
      typeof model.name === 'string' &&
      Array.isArray(model.available_models)
    ));

    if (validModels.length === 0) {
      console.warn('No valid models found in response');
    }

    return validModels;
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
};

// Model API Keys
export const getModelApiKey = async (modelName) => {
  try {
    // console.log(`Fetching API key for ${modelName}`);
    const response = await api.get(`/models/${modelName}/api-key`);
    // console.log(`API key response for ${modelName}:`, response.data);
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      // console.log(`No API key found for ${modelName}, will initialize`);
      await setModelApiKey(modelName, '');
      return { apiKey: null };
    }
    console.error(`Error fetching API key for ${modelName}:`, error);
    throw error;
  }
};

export const setModelApiKey = async (modelName, apiKey) => {
  try {
    // console.log(`Setting API key for ${modelName}:`, apiKey ? '[KEY PROVIDED]' : '[NO KEY]');
    const response = await api.post(`/models/${modelName}/api-key`, { apiKey });
    
    const verifyResponse = await getModelApiKey(modelName);
    const saveSuccessful = (apiKey && verifyResponse.apiKey) || (!apiKey && !verifyResponse.apiKey);
    
    if (!saveSuccessful) {
      throw new Error('API key verification failed');
    }
    
    // console.log(`Successfully saved API key for ${modelName}`);
    return response.data;
  } catch (error) {
    console.error(`Error setting API key for ${modelName}:`, error);
    throw error;
  }
};

// System Prompts
export const getSystemPrompts = async () => {
  try {
    const response = await api.get('/system-prompts');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching system prompts:', error);
    return [];
  }
};

export const createSystemPrompt = (prompt) => 
  api.post('/system-prompts', prompt);
export const updateSystemPrompt = (id, prompt) => 
  api.put(`/system-prompts/${id}`, prompt);

// Results
export const getResults = async () => {
  try {
    const response = await api.get('/results');
    return response.data;
  } catch (error) {
    console.error('Error fetching results:', error);
    throw error;
  }
};

// Modules
export const getModules = async () => {
  try {
    const response = await api.get('/modules');
    return response.data;
  } catch (error) {
    console.error('Error fetching modules:', error);
    throw error;
  }
};

export const getGradingMethods = async () => {
  try {
    const response = await api.get('/modules/grading-methods');
    return response.data;
  } catch (error) {
    console.error('Error fetching grading methods:', error);
    throw error;
  }
};

export const createModule = async (module) => {
  try {
    const response = await api.post('/modules', {
      name: module.name,
      description: module.description,
      purpose: module.purpose,
      relevance: module.relevance,
      grading_methods: module.grading_methods
    });
    return response.data;
  } catch (error) {
    console.error('Error creating module:', error);
    throw error;
  }
};

export const getModuleDetails = async (id) => {
  try {
    const response = await api.get(`/modules/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching module details:', error);
    throw error;
  }
};

export const deleteModule = async (id) => {
  try {
    const response = await api.delete(`/modules/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting module:', error);
    throw error;
  }
};

// Test Running
export const runTests = async (moduleId, testCaseIds, implementation, model, useSystemPrompt = false) => {
  try {
    const response = await api.post(`/modules/${moduleId}/run-tests`, {
      testCaseIds,
      implementation,
      model,
      useSystemPrompt
    });
    return response.data;
  } catch (error) {
    console.error('Error running tests:', error);
    throw new Error(error.response?.data?.message || 'Failed to run tests');
  }
};

export const cancelTest = async (testCaseId) => {
  try {
    const response = await api.post(`/experiments/cancel/${testCaseId}`);
    return response.data;
  } catch (error) {
    console.error('Error canceling test:', error);
    throw error;
  }
};
