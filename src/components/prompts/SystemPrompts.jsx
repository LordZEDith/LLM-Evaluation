import { useState, useEffect } from 'react';
import { getSystemPrompts, createSystemPrompt, updateSystemPrompt } from '../../api';

export function SystemPrompts() {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [newPrompt, setNewPrompt] = useState({
    name: '',
    content: '',
    description: '',
    tags: [],
    metadata: {
      useCase: '',
      version: '1.0'
    }
  });

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    try {
      setError(null);
      const data = await getSystemPrompts();
      setPrompts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching system prompts:', error);
      setError('Failed to fetch system prompts');
      setPrompts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePrompt = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createSystemPrompt(newPrompt);
      setNewPrompt({
        name: '',
        content: '',
        description: '',
        tags: [],
        metadata: {
          useCase: '',
          version: '1.0'
        }
      });
      await fetchPrompts();
    } catch (error) {
      console.error('Error creating system prompt:', error);
      alert('Failed to create system prompt');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrompt = async (e) => {
    e.preventDefault();
    if (!editingPrompt) return;

    setLoading(true);
    try {
      await updateSystemPrompt(editingPrompt.id, editingPrompt);
      setEditingPrompt(null);
      await fetchPrompts();
    } catch (error) {
      console.error('Error updating system prompt:', error);
      alert('Failed to update system prompt');
    } finally {
      setLoading(false);
    }
  };

  const handleTagsChange = (value, isNewPrompt = true) => {
    const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag);
    if (isNewPrompt) {
      setNewPrompt(prev => ({ ...prev, tags }));
    } else {
      setEditingPrompt(prev => ({ ...prev, tags }));
    }
  };

  const startEditing = (prompt) => {
    setEditingPrompt({ ...prompt });
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 dark:text-white">System Prompts</h1>

      {/* Create New System Prompt Form */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-8">
        <h2 className="text-xl font-semibold mb-4 dark:text-white">Create New System Prompt</h2>
        <form onSubmit={handleCreatePrompt} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Name</label>
            <input
              type="text"
              value={newPrompt.name}
              onChange={(e) => setNewPrompt(prev => ({ ...prev, name: e.target.value }))}
              className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Content</label>
            <textarea
              value={newPrompt.content}
              onChange={(e) => setNewPrompt(prev => ({ ...prev, content: e.target.value }))}
              className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded h-32 font-mono focus:ring-blue-500 focus:border-blue-500"
              required
              placeholder="Enter your system prompt here..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Description</label>
            <textarea
              value={newPrompt.description}
              onChange={(e) => setNewPrompt(prev => ({ ...prev, description: e.target.value }))}
              className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded h-24 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Describe what this system prompt is designed to do..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Tags (comma-separated)</label>
            <input
              type="text"
              value={newPrompt.tags.join(', ')}
              onChange={(e) => handleTagsChange(e.target.value)}
              className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., customer-service, technical, formal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Use Case</label>
            <input
              type="text"
              value={newPrompt.metadata.useCase}
              onChange={(e) => setNewPrompt(prev => ({
                ...prev,
                metadata: { ...prev.metadata, useCase: e.target.value }
              }))}
              className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., code-review, customer-support"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-800 transition-colors"
          >
            Create System Prompt
          </button>
        </form>
      </div>

      {/* System Prompts List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4 dark:text-white">Existing System Prompts</h2>
          {loading ? (
            <div className="dark:text-gray-300">Loading...</div>
          ) : (
            <div className="space-y-6">
              {prompts.map(prompt => (
                <div key={prompt.id} className="border-b dark:border-gray-700 pb-4 last:border-b-0">
                  {editingPrompt?.id === prompt.id ? (
                    <form onSubmit={handleUpdatePrompt} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Name</label>
                        <input
                          type="text"
                          value={editingPrompt.name}
                          onChange={(e) => setEditingPrompt(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Content</label>
                        <textarea
                          value={editingPrompt.content}
                          onChange={(e) => setEditingPrompt(prev => ({ ...prev, content: e.target.value }))}
                          className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded h-32 font-mono focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Description</label>
                        <textarea
                          value={editingPrompt.description}
                          onChange={(e) => setEditingPrompt(prev => ({ ...prev, description: e.target.value }))}
                          className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded h-24 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Tags</label>
                        <input
                          type="text"
                          value={editingPrompt.tags.join(', ')}
                          onChange={(e) => handleTagsChange(e.target.value, false)}
                          className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Use Case</label>
                        <input
                          type="text"
                          value={editingPrompt.metadata.useCase}
                          onChange={(e) => setEditingPrompt(prev => ({
                            ...prev,
                            metadata: { ...prev.metadata, useCase: e.target.value }
                          }))}
                          className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div className="flex space-x-2">
                        <button
                          type="submit"
                          disabled={loading}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-green-300 dark:disabled:bg-green-800 transition-colors"
                        >
                          Save Changes
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingPrompt(null)}
                          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-medium dark:text-white">{prompt.name}</h3>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {prompt.tags.map(tag => (
                              <span key={tag} className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => startEditing(prompt)}
                          className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                        >
                          Edit
                        </button>
                      </div>
                      <div className="mt-4 space-y-3">
                        <div>
                          <span className="font-medium dark:text-white">Content:</span>
                          <pre className="mt-1 p-2 bg-gray-50 dark:bg-gray-700 rounded font-mono whitespace-pre-wrap dark:text-gray-300">
                            {prompt.content}
                          </pre>
                        </div>
                        {prompt.description && (
                          <div>
                            <span className="font-medium dark:text-white">Description:</span>
                            <p className="mt-1 text-gray-600 dark:text-gray-300">{prompt.description}</p>
                          </div>
                        )}
                        <div>
                          <span className="font-medium dark:text-white">Use Case:</span>
                          <span className="ml-2 dark:text-gray-300">{prompt.metadata.useCase}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 