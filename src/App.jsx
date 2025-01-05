import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Login } from './components/auth/Login';
import { InstallationWizard } from './components/auth/InstallationWizard';
import { DashboardLayout } from './components/layouts/DashboardLayout';
import { PrivateRoute } from './components/auth/PrivateRoute';
import { Settings } from './components/settings/Settings';
import { ModelComparison } from './components/models/ModelComparison';
import { TestCases } from './components/testcases/TestCases';
import { SystemPrompts } from './components/prompts/SystemPrompts';
import { Results } from './components/results/Results';
import { Dashboard } from './components/dashboard/Dashboard';
import { Runs } from './components/runs/Runs';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    checkInstallation();
  }, []);

  const checkInstallation = async () => {
    try {
      const response = await axios.get('/api/install/status');
      setIsInstalled(response.data.installed);
    } catch (error) {
      console.error('Failed to check installation status:', error);
      setIsInstalled(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        {/* Installation Route */}
        <Route 
          path="/install" 
          element={isInstalled ? <Navigate to="/login" /> : <InstallationWizard />} 
        />

        {/* Public Routes */}
        <Route 
          path="/login" 
          element={!isInstalled ? <Navigate to="/install" /> : <Login />} 
        />

        {/* Protected Routes */}
        <Route element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/test-cases" element={<TestCases />} />
          <Route path="/models/compare" element={<ModelComparison />} />
          <Route path="/system-prompts" element={<SystemPrompts />} />
          <Route path="/results" element={<Results />} />
          <Route path="/runs" element={<Runs />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* Default Route */}
        <Route 
          path="*" 
          element={<Navigate to={isInstalled ? "/dashboard" : "/install"} />} 
        />
      </Routes>
    </Router>
  );
}

export default App;
