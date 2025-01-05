import { useState, useEffect } from 'react';
import { getModels } from '../../api';

export function ModelSelectionDialog({ isOpen, onClose, onSelect }) {
    const [models, setModels] = useState([]);
    const [selectedImplementation, setSelectedImplementation] = useState(null);
    const [selectedModel, setSelectedModel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            fetchModels();
        }
    }, [isOpen]);

    const fetchModels = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getModels();
            
            if (!Array.isArray(data)) {
                console.error('Models data is not an array:', data);
                setError('Invalid models data format');
                return;
            }
            
            setModels(data);
            if (data.length > 0) {
                setSelectedImplementation(data[0]);
            }
        } catch (error) {
            console.error('Error fetching models:', error);
            setError('Failed to load models');
        } finally {
            setLoading(false);
        }
    };

    const handleImplementationChange = (implementation) => {
        setSelectedImplementation(implementation);
        setSelectedModel(null);
    };

    const handleModelSelect = (model) => {
        setSelectedModel(model);
    };

    const handleConfirm = () => {
        if (selectedImplementation && selectedModel) {
            onSelect({
                implementation: selectedImplementation.name,
                model: selectedModel
            });
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
                <h2 className="text-xl font-bold mb-4 dark:text-white">Select Model</h2>
                
                {loading ? (
                    <div className="text-center py-4 dark:text-gray-300">Loading models...</div>
                ) : error ? (
                    <div className="text-center py-4 text-red-600 dark:text-red-400">{error}</div>
                ) : models.length === 0 ? (
                    <div className="text-center py-4 dark:text-gray-300">No models available</div>
                ) : (
                    <>
                        {/* Implementation Selection */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Implementation
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {models.map(implementation => (
                                    <button
                                        key={implementation.name}
                                        onClick={() => handleImplementationChange(implementation)}
                                        className={`p-2 rounded border ${
                                            selectedImplementation?.name === implementation.name
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50 dark:border-blue-400 dark:text-white'
                                                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        {implementation.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Model Selection */}
                        {selectedImplementation && Array.isArray(selectedImplementation.available_models) && (
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Model
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {selectedImplementation.available_models.map(model => (
                                        <button
                                            key={model}
                                            onClick={() => handleModelSelect(model)}
                                            className={`p-2 rounded border ${
                                                selectedModel === model
                                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50 dark:border-blue-400 dark:text-white'
                                                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                            }`}
                                        >
                                            {model}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={!selectedModel}
                                className={`px-4 py-2 text-sm font-medium text-white rounded ${
                                    selectedModel
                                        ? 'bg-blue-500 hover:bg-blue-600'
                                        : 'bg-blue-300 dark:bg-blue-400/50 cursor-not-allowed'
                                }`}
                            >
                                Confirm
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
} 