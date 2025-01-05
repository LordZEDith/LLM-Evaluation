import React, { useState, useEffect, useRef } from 'react';
import { getResults } from '../../api';
import html2pdf from 'html2pdf.js';

export function ModelComparison() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedModels, setSelectedModels] = useState(new Set());
  const [selectedModules, setSelectedModules] = useState(new Set());
  const [viewAll, setViewAll] = useState(true);

  const comparisonTableRef = useRef(null);

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      const data = await getResults();
      setResults(data);
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateModuleScore = (moduleResults) => {
    if (!moduleResults || moduleResults.length === 0) return null;

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

    if (scores.length === 0) return null;
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
  };

  const processResults = () => {
    const modelModuleGroups = results.reduce((acc, result) => {
      const modelKey = `${result.model_implementation}-${result.model_name}`;
      const moduleKey = `${result.module_id}-${result.module_name}`;

      if (!acc[modelKey]) {
        acc[modelKey] = {};
      }
      if (!acc[modelKey][moduleKey]) {
        acc[modelKey][moduleKey] = [];
      }
      acc[modelKey][moduleKey].push(result);
      return acc;
    }, {});

    const modules = new Set();
    const models = new Set();
    Object.entries(modelModuleGroups).forEach(([modelKey, moduleResults]) => {
      models.add(modelKey);
      Object.keys(moduleResults).forEach(moduleKey => modules.add(moduleKey));
    });

    const scores = {};
    models.forEach(modelKey => {
      scores[modelKey] = {};
      modules.forEach(moduleKey => {
        const moduleResults = modelModuleGroups[modelKey]?.[moduleKey];
        scores[modelKey][moduleKey] = calculateModuleScore(moduleResults);
      });
    });

    let filteredModels = Array.from(models);
    let filteredModules = Array.from(modules);

    if (!viewAll) {
      if (selectedModels.size > 0) {
        filteredModels = filteredModels.filter(model => selectedModels.has(model));
      }
      if (selectedModules.size > 0) {
        filteredModules = filteredModules.filter(module => selectedModules.has(module));
      }
    }

    return {
      modules: filteredModules,
      models: filteredModels,
      allModels: Array.from(models),
      allModules: Array.from(modules),
      scores
    };
  };

  const toggleModel = (modelKey) => {
    const newSelected = new Set(selectedModels);
    if (newSelected.has(modelKey)) {
      newSelected.delete(modelKey);
    } else {
      newSelected.add(modelKey);
    }
    setSelectedModels(newSelected);
    setViewAll(false);
  };

  const toggleModule = (moduleKey) => {
    const newSelected = new Set(selectedModules);
    if (newSelected.has(moduleKey)) {
      newSelected.delete(moduleKey);
    } else {
      newSelected.add(moduleKey);
    }
    setSelectedModules(newSelected);
    setViewAll(false);
  };

  const toggleViewAll = () => {
    setViewAll(!viewAll);
    if (!viewAll) {
      setSelectedModels(new Set());
      setSelectedModules(new Set());
    }
  };

  const generatePDF = (elementRef, filename) => {
    const element = elementRef.current;
    
    // Create a clone of the element for PDF generation
    const clone = element.cloneNode(true);
    clone.style.background = 'white';
    clone.style.padding = '20px';
    
    // Remove all dark mode classes from the clone
    const darkElements = clone.querySelectorAll('[class*="dark:"]');
    darkElements.forEach(el => {
      el.className = el.className.split(' ')
        .filter(cls => !cls.startsWith('dark:'))
        .join(' ');
    });

    // Force light theme styles
    const elementsWithDarkBg = clone.querySelectorAll('[class*="bg-"]');
    elementsWithDarkBg.forEach(el => {
      el.classList.remove('bg-gray-800', 'bg-gray-700');
      el.classList.add('bg-white');
    });

    // Ensure text is visible
    const textElements = clone.querySelectorAll('*');
    textElements.forEach(el => {
      if (getComputedStyle(el).color === 'rgb(255, 255, 255)' || 
          el.classList.contains('text-white')) {
        el.style.color = '#111827'; // text-gray-900
      }
    });

    // Add some base styles to ensure visibility
    const style = document.createElement('style');
    style.textContent = `
      .pdf-content {
        background: white !important;
        color: #111827 !important;
      }
      .pdf-content * {
        color: #111827 !important;
      }
      .pdf-content table {
        width: 100%;
        border-collapse: collapse;
      }
      .pdf-content th, .pdf-content td {
        border: 1px solid #e5e7eb;
        padding: 8px;
        text-align: left;
      }
      .pdf-content th {
        background-color: #f9fafb;
      }
      .pdf-content .text-green-600 {
        color: #059669 !important;
      }
    `;
    clone.prepend(style);

    const opt = {
      margin: [0.5, 0.5],
      filename: filename,
      jsPDF: { 
        unit: 'in', 
        format: 'letter', 
        orientation: 'landscape',
      },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      },
      pagebreak: { mode: 'avoid-all' }
    };

    // Create a temporary container
    const container = document.createElement('div');
    container.appendChild(clone);
    document.body.appendChild(container);

    // Generate PDF
    html2pdf()
      .set(opt)
      .from(clone)
      .save()
      .then(() => {
        // Clean up
        document.body.removeChild(container);
      });
  };

  // Add a wrapper div for PDF generation that will always use light theme
  const PDFWrapper = ({ children }) => (
    <div className="pdf-content print:bg-white print:text-gray-900">
      {children}
    </div>
  );

  if (loading) {
    return <div className="p-6 dark:text-gray-300">Loading...</div>;
  }

  const { modules, models, allModels, allModules, scores } = processResults();

  return (
    <div className="p-6">
      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold dark:text-white">Select Models and Modules</h2>
          <button
            onClick={toggleViewAll}
            className={`px-4 py-2 rounded transition-colors ${
              viewAll 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            View All
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="font-medium mb-3 dark:text-white">Models</h3>
            <div className="space-y-2">
              {allModels.map(modelKey => {
                const [implementation, ...nameParts] = modelKey.split('-');
                const name = nameParts.join('-');
                return (
                  <label key={modelKey} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={viewAll || selectedModels.has(modelKey)}
                      onChange={() => toggleModel(modelKey)}
                      disabled={viewAll}
                      className="rounded dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span className="dark:text-gray-300">{name}</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">({implementation})</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="font-medium mb-3 dark:text-white">Modules</h3>
            <div className="space-y-2">
              {allModules.map(moduleKey => {
                const [, moduleName] = moduleKey.split('-');
                return (
                  <label key={moduleKey} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={viewAll || selectedModules.has(moduleKey)}
                      onChange={() => toggleModule(moduleKey)}
                      disabled={viewAll}
                      className="rounded dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span className="dark:text-gray-300">{moduleName}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto mb-8">
        <div className="flex justify-end mb-4">
          <button
            onClick={() => generatePDF(comparisonTableRef, 'model-comparison.pdf')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center space-x-2 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
            </svg>
            <span>Save as PDF</span>
          </button>
        </div>
        <div ref={comparisonTableRef}>
          <PDFWrapper>
            <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg shadow">
              <thead>
                <tr>
                  <th className="p-4 border-b dark:border-gray-700 text-left">
                    <div className="font-bold text-lg dark:text-white">Evaluation Frameworks</div>
                  </th>
                  {models.map(modelKey => {
                    const [implementation, ...nameParts] = modelKey.split('-');
                    const name = nameParts.join('-');
                    return (
                      <th key={modelKey} className="p-4 border-b dark:border-gray-700 text-left">
                        <div className="font-medium dark:text-white">{name}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">{implementation}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {modules.map(moduleKey => {
                  const [, moduleName] = moduleKey.split('-');
                  const moduleScores = models.map(modelKey => scores[modelKey][moduleKey]);
                  const maxScore = Math.max(...moduleScores.filter(score => score !== null));
                  return (
                    <tr key={moduleKey} className="border-b dark:border-gray-700 last:border-b-0">
                      <td className="p-4 font-medium dark:text-white">{moduleName}</td>
                      {models.map(modelKey => {
                        const score = scores[modelKey][moduleKey];
                        const isHighest = score && Math.abs(parseFloat(score) - maxScore) < 0.001;
                        return (
                          <td key={`${moduleKey}-${modelKey}`} className="p-4">
                            <div className={`font-medium ${isHighest ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-300'}`}>
                              {score ? `${(score * 100).toFixed(1)}%` : '—'}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </PDFWrapper>
        </div>
      </div>

      <div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          <div>
            <h3 className="font-medium mb-2 dark:text-white">Grading Methods</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <span className="font-medium dark:text-white">ROUGE:</span>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Evaluates text similarity using precision, recall, and F-measures across different n-gram levels.
                    Score is the average of ROUGE-1, ROUGE-2, and ROUGE-L F-measures.
                  </p>
                  <ul className="mt-2 list-disc list-inside text-sm text-gray-600 dark:text-gray-400">
                    <li>ROUGE-1: Unigram overlap</li>
                    <li>ROUGE-2: Bigram overlap</li>
                    <li>ROUGE-L: Longest common subsequence</li>
                  </ul>
                </div>
                <div>
                  <span className="font-medium dark:text-white">BLEU:</span>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Measures translation quality by comparing n-gram matches between model output and reference text.
                    Incorporates both precision and brevity penalty.
                  </p>
                  <ul className="mt-2 list-disc list-inside text-sm text-gray-600 dark:text-gray-400">
                    <li>N-gram precision up to 4-grams</li>
                    <li>Brevity penalty for short outputs</li>
                    <li>Industry standard for translation</li>
                  </ul>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <span className="font-medium dark:text-white">METEOR:</span>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Evaluates translation by considering exact matches, stems, synonyms, and paraphrases.
                    Addresses some limitations of BLEU scoring.
                  </p>
                  <ul className="mt-2 list-disc list-inside text-sm text-gray-600 dark:text-gray-400">
                    <li>Semantic matching capability</li>
                    <li>Word order consideration</li>
                    <li>Language-aware evaluation</li>
                  </ul>
                </div>
                <div>
                  <span className="font-medium dark:text-white">LLM JUDGE:</span>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    AI-based evaluation using language models to assess response quality across multiple attributes.
                    Provides detailed feedback on various aspects.
                  </p>
                  <ul className="mt-2 list-disc list-inside text-sm text-gray-600 dark:text-gray-400">
                    <li>Coherence and relevance</li>
                    <li>Factual accuracy</li>
                    <li>Closest to Human Judge</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6">
            <h3 className="font-medium mb-2 dark:text-white">Scoring</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium mb-2 dark:text-white">Score Calculation</h4>
                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>All scores are normalized to percentages (0-100%)</li>
                  <li>Module scores are averages across all test cases</li>
                  <li>Highest scores in each category are highlighted in green</li>
                  <li>Missing or unavailable scores are marked with "—"</li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2 dark:text-white">Score Interpretation</h4>
                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>{">"} 70%: Excellent performance</li>
                  <li>51-70%: Good performance</li>
                  <li>{"<"} 51%: Needs improvement</li>
                  <li>Combined scores weighted by method reliability</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="font-medium mb-2 dark:text-white">Testing Methodology</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium mb-2 dark:text-white">Test Execution</h4>
                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>Each model tested on identical prompts</li>
                  <li>Multiple test cases per module</li>
                  <li>Standardized system prompts</li>
                  <li>Controlled testing environment</li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2 dark:text-white">Test Creation</h4>
                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>Add Test Cases within Modules</li>
                  <li>Run Single or Multiple Test Cases</li>
                  <li>Evaluation Run Status Tracking</li>
                  <li>Batch Testing for all Models</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 