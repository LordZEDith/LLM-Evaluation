import { useState, useEffect, useRef } from 'react';
import { getModelApiKey, setModelApiKey, getModels } from '../../api';

export function Settings() {
  const [settings, setSettings] = useState({
    models: {},
    evaluation: {
      defaultMetrics: {
        useBleu: true,
        useRouge: true,
        useMeteor: true,
        useLLMJudge: true
      },
      llmJudgeSettings: {
        model: 'gpt-4',
        temperature: 0.3,
        maxTokens: 1000
      },
      batchSize: 10,
      concurrentRequests: 3,
      retryAttempts: 2
    },
    ui: {
      theme: 'light',
      resultsPerPage: 20,
      defaultView: 'list'
    }
  });

  const [modelConfigs, setModelConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const mounted = useRef(false);
  const initialized = useRef(false);

  useEffect(() => {
    mounted.current = true;

    if (!initialized.current) {
      initialized.current = true;
      
      const savedSettings = localStorage.getItem('llm-eval-settings');
      if (savedSettings && mounted.current) {
        setSettings(JSON.parse(savedSettings));
      }

      fetchModelConfigs();
    }

    return () => {
      mounted.current = false;
    };
  }, []);

  const fetchModelConfigs = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      setError(null);
      const modelData = await getModels();
      
      if (!mounted.current) return;
      
      if (!Array.isArray(modelData)) {
        throw new Error('Invalid model data received');
      }
      
      setModelConfigs(modelData);
      
      const newSettings = { ...settings };
      
      for (const model of modelData) {
        if (!mounted.current) return;
        
        if (!newSettings.models[model.name]) {
          newSettings.models[model.name] = {
            apiKey: '',
            enabled: true
          };
        }
        
        if (model.requires_api_key) {
          try {
            const keyResponse = await getModelApiKey(model.name);
            if (keyResponse.apiKey && mounted.current) {
              newSettings.models[model.name].apiKey = keyResponse.apiKey;
            }
          } catch (error) {
            console.log(`No API key found for ${model.name}, will be created when saved`);
          }
        }
      }
      
      if (mounted.current) {
        setSettings(newSettings);
      }
    } catch (error) {
      if (mounted.current) {
        console.error('Error fetching model configurations:', error);
        setError(error.message || 'Failed to fetch model configurations');
        setModelConfigs([]);
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      for (const model of modelConfigs) {
        if (model.requires_api_key) {
          const apiKey = settings.models[model.name]?.apiKey || '';
          //console.log(`Saving API key for ${model.name}:`, apiKey ? '[KEY PRESENT]' : '[NO KEY]');
          
          try {
            const saveResponse = await setModelApiKey(model.name, apiKey);
            //console.log(`Save response for ${model.name}:`, saveResponse);
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const verifyResponse = await getModelApiKey(model.name);
            //console.log(`Verify response for ${model.name}:`, verifyResponse);
            
            const saveSuccessful = (apiKey && verifyResponse.apiKey) || (!apiKey && !verifyResponse.apiKey);
            //console.log(`Save verification for ${model.name}:`, {
            //  provided: apiKey ? '[KEY PROVIDED]' : '[NO KEY]',
            //  saved: verifyResponse.apiKey ? '[KEY SAVED]' : '[NO KEY SAVED]',
            //  successful: saveSuccessful
            //});
            
            if (!saveSuccessful) {
              throw new Error('API key verification failed');
            }
          } catch (error) {
            console.error(`Error saving/verifying API key for ${model.name}:`, error);
            throw new Error(`Failed to save API key for ${model.name}: ${error.message}`);
          }
        }
      }

      // Save to localStorage (without API keys)
      const settingsForStorage = {
        ...settings,
        models: Object.fromEntries(
          Object.entries(settings.models).map(([name, config]) => [
            name,
            { ...config, apiKey: '' }
          ])
        )
      };
      localStorage.setItem('llm-eval-settings', JSON.stringify(settingsForStorage));
      
      await fetchModelConfigs();
      
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setError(error.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const updateModelSettings = (modelName, field, value) => {
    setSettings(prev => ({
      ...prev,
      models: {
        ...prev.models,
        [modelName]: {
          ...prev.models[modelName],
          [field]: value
        }
      }
    }));
  };

  const updateEvalSettings = (section, field, value) => {
    setSettings(prev => ({
      ...prev,
      evaluation: {
        ...prev.evaluation,
        [section]: {
          ...prev.evaluation[section],
          [field]: value
        }
      }
    }));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold dark:text-white">Settings</h1>
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-800"
        >
          {loading ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-500 text-red-700 dark:text-red-400 rounded">
          {error}
        </div>
      )}

      {/* Model Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 dark:text-white">Model Settings</h2>
        <div className="space-y-4">
          {modelConfigs && modelConfigs.length > 0 ? (
            modelConfigs.map(model => (
              <div key={model.name} className="border-b dark:border-gray-700 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-medium dark:text-white">{model.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{model.description}</p>
                  </div>
                  <label className="flex items-center dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={settings.models[model.name]?.enabled ?? true}
                      onChange={(e) => updateModelSettings(model.name, 'enabled', e.target.checked)}
                      className="mr-2 rounded dark:bg-gray-700 dark:border-gray-600"
                    />
                    Enabled
                  </label>
                </div>
                {model.requires_api_key && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">API Key</label>
                    <input
                      type="password"
                      value={settings.models[model.name]?.apiKey ?? ''}
                      onChange={(e) => updateModelSettings(model.name, 'apiKey', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder={`Enter ${model.name} API Key`}
                    />
                  </div>
                )}
                <div className="mt-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Available Models</label>
                  <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {model.available_models.join(', ')}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-gray-500 dark:text-gray-400 text-center py-4">
              {loading ? 'Loading models...' : 'No models available'}
            </div>
          )}
        </div>
      </div>

      {/* Evaluation Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 dark:text-white">Evaluation Settings</h2>
        
        {/* Metrics */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3 dark:text-white">Default Metrics</h3>
          <div className="space-y-2">
            <label className="flex items-center dark:text-gray-300">
              <input
                type="checkbox"
                checked={settings.evaluation.defaultMetrics.useBleu}
                onChange={(e) => updateEvalSettings('defaultMetrics', 'useBleu', e.target.checked)}
                className="mr-2 rounded dark:bg-gray-700 dark:border-gray-600"
              />
              Use BLEU Score
            </label>
            <label className="flex items-center dark:text-gray-300">
              <input
                type="checkbox"
                checked={settings.evaluation.defaultMetrics.useRouge}
                onChange={(e) => updateEvalSettings('defaultMetrics', 'useRouge', e.target.checked)}
                className="mr-2 rounded dark:bg-gray-700 dark:border-gray-600"
              />
              Use ROUGE Score
            </label>
            <label className="flex items-center dark:text-gray-300">
              <input
                type="checkbox"
                checked={settings.evaluation.defaultMetrics.useMeteor}
                onChange={(e) => updateEvalSettings('defaultMetrics', 'useMeteor', e.target.checked)}
                className="mr-2 rounded dark:bg-gray-700 dark:border-gray-600"
              />
              Use METEOR Score
            </label>
            <label className="flex items-center dark:text-gray-300">
              <input
                type="checkbox"
                checked={settings.evaluation.defaultMetrics.useLLMJudge}
                onChange={(e) => updateEvalSettings('defaultMetrics', 'useLLMJudge', e.target.checked)}
                className="mr-2 rounded dark:bg-gray-700 dark:border-gray-600"
              />
              Use LLM Judge
            </label>
          </div>
        </div>

        {/* Performance Settings */}
        <div>
          <h3 className="text-lg font-medium mb-3 dark:text-white">Performance Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Batch Size</label>
              <input
                type="number"
                min="1"
                max="50"
                value={settings.evaluation.batchSize}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  evaluation: { ...prev.evaluation, batchSize: parseInt(e.target.value) }
                }))}
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Concurrent Requests</label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.evaluation.concurrentRequests}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  evaluation: { ...prev.evaluation, concurrentRequests: parseInt(e.target.value) }
                }))}
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Retry Attempts</label>
              <input
                type="number"
                min="0"
                max="5"
                value={settings.evaluation.retryAttempts}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  evaluation: { ...prev.evaluation, retryAttempts: parseInt(e.target.value) }
                }))}
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 