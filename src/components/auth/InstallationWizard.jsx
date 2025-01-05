import axios from 'axios';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function InstallationWizard() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    // DB Settings
    dbHost: 'localhost',
    dbPort: '3306',
    dbName: 'llm_evaluation',
    dbUser: 'root',
    dbPassword: '',
    // SMTP Settings
    smtpHost: '',
    smtpPort: '',
    smtpUser: '',
    smtpPassword: '',
    smtpFromEmail: '',
    smtpFromName: 'LLM Evaluation Platform',
    // Admin Account
    adminEmail: '',
    adminPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [testStatus, setTestStatus] = useState({ db: false, smtp: false });
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (['dbHost', 'dbPort', 'dbName', 'dbUser', 'dbPassword'].includes(name)) {
      setTestStatus(prev => ({ ...prev, db: false }));
    } else if (['smtpHost', 'smtpPort', 'smtpUser', 'smtpPassword', 'smtpFromEmail'].includes(name)) {
      setTestStatus(prev => ({ ...prev, smtp: false }));
    }
  };

  const testConnection = async (type) => {
    setLoading(true);
    setError('');

    try {
      if (type === 'db') {
        const requiredFields = {
          'Database Host': formData.dbHost,
          'Database Port': formData.dbPort,
          'Database Name': formData.dbName,
          'Database User': formData.dbUser
        };

        const missingFields = Object.entries(requiredFields)
          .filter(([_, value]) => !value?.trim())
          .map(([field]) => field);

        if (missingFields.length > 0) {
          setError(`Please fill in the following required fields: ${missingFields.join(', ')}`);
          return;
        }

        const response = await axios.post('/api/install/test-db', {
          host: formData.dbHost,
          port: formData.dbPort,
          database: formData.dbName,
          user: formData.dbUser,
          password: formData.dbPassword
        });

        if (response.data.success) {
          setTestStatus(prev => ({ ...prev, db: true }));
        }
      } else if (type === 'smtp') {
        const requiredFields = {
          'SMTP Host': formData.smtpHost,
          'SMTP Port': formData.smtpPort,
          'SMTP Username': formData.smtpUser,
          'SMTP Password': formData.smtpPassword,
          'From Name': formData.smtpFromName,
          'From Email': formData.smtpFromEmail
        };

        const missingFields = Object.entries(requiredFields)
          .filter(([_, value]) => !value?.trim())
          .map(([field]) => field);

        if (missingFields.length > 0) {
          setError(`Please fill in the following required fields: ${missingFields.join(', ')}`);
          return;
        }

        const response = await axios.post('/api/install/test-smtp', {
          host: formData.smtpHost,
          port: formData.smtpPort,
          user: formData.smtpUser,
          password: formData.smtpPassword,
          fromEmail: formData.smtpFromEmail,
          fromName: formData.smtpFromName
        });

        if (response.data.success) {
          setTestStatus(prev => ({ ...prev, smtp: true }));
        }
        else if (response.data.success === false) {
          const errorMessage = response.data.error || 'An unexpected error occurred. Please try again.';
          setError(errorMessage);
        }
      }
    } catch (error) {
      let errorMessage = '';
      
      if (error.response) {
        errorMessage = error.response.data?.error || 
          (type === 'db' ? 
            'Unable to connect to database. Please check your credentials and try again.' :
            'Unable to connect to SMTP server. Please check your credentials and try again.');
      } else if (error.request) {
        errorMessage = 'Unable to reach the server. Please check your connection and try again.';
      } else {
        console.log(error)
        errorMessage = 'An unexpected error occurred. Please try again 1.';
      }

      setError(errorMessage);
      setTestStatus(prev => ({ ...prev, [type]: false }));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (step === 1) {
        if (!testStatus.db) {
          setError('Please test the database connection first');
          return;
        }
        setStep(2);
      } else if (step === 2) {
        if (!testStatus.smtp) {
          setError('Please test the SMTP connection first');
          return;
        }
        setStep(3);
      } else {
        if (!formData.adminEmail?.trim()) {
          setError('Please enter an admin email address');
          return;
        }

        if (!formData.adminPassword?.trim()) {
          setError('Please enter an admin password');
          return;
        }

        if (formData.adminPassword !== formData.confirmPassword) {
          setError('Passwords do not match');
          return;
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(formData.adminPassword)) {
          setError('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character');
          return;
        }

        const response = await axios.post('/api/install/complete', {
          database: {
            host: formData.dbHost,
            port: formData.dbPort,
            name: formData.dbName,
            user: formData.dbUser,
            password: formData.dbPassword
          },
          smtp: {
            host: formData.smtpHost,
            port: formData.smtpPort,
            user: formData.smtpUser,
            password: formData.smtpPassword,
            fromEmail: formData.smtpFromEmail
          },
          admin: {
            email: formData.adminEmail,
            password: formData.adminPassword
          }
        });

        if (response.data.success) {
          localStorage.setItem('installation_complete', 'true');
          navigate('/login');
        }
      }
    } catch (error) {
      let errorMessage = '';
      
      if (error.response) {
        errorMessage = error.response.data?.error || 'Installation failed. Please try again.';
      } else if (error.request) {
        errorMessage = 'Unable to reach the server. Please check your connection and try again.';
      } else {
        errorMessage = 'An unexpected error occurred. Please try again.';
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <>
            <div>
              <label htmlFor="dbHost" className="block text-sm font-medium text-gray-700">
                Database Host
              </label>
              <input
                id="dbHost"
                name="dbHost"
                type="text"
                required
                value={formData.dbHost}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="localhost"
              />
            </div>
            <div>
              <label htmlFor="dbPort" className="block text-sm font-medium text-gray-700">
                Database Port
              </label>
              <input
                id="dbPort"
                name="dbPort"
                type="number"
                required
                value={formData.dbPort}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="3306"
              />
            </div>
            <div>
              <label htmlFor="dbName" className="block text-sm font-medium text-gray-700">
                Database Name
              </label>
              <input
                id="dbName"
                name="dbName"
                type="text"
                required
                value={formData.dbName}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="llm_evaluation"
              />
            </div>
            <div>
              <label htmlFor="dbUser" className="block text-sm font-medium text-gray-700">
                Database User
              </label>
              <input
                id="dbUser"
                name="dbUser"
                type="text"
                required
                value={formData.dbUser}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="root"
              />
            </div>
            <div>
              <label htmlFor="dbPassword" className="block text-sm font-medium text-gray-700">
                Database Password
              </label>
              <input
                id="dbPassword"
                name="dbPassword"
                type="password"
                value={formData.dbPassword}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => testConnection('db')}
                disabled={loading}
                className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {loading ? 'Testing...' : testStatus.db ? '✓ Connection Verified' : 'Test Connection'}
              </button>
              <button
                type="submit"
                disabled={loading || !testStatus.db}
                className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </>
        );
      case 2:
        return (
          <>
            <div>
              <label htmlFor="smtpHost" className="block text-sm font-medium text-gray-700">
                SMTP Host
              </label>
              <input
                id="smtpHost"
                name="smtpHost"
                type="text"
                required
                value={formData.smtpHost}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="smtpPort" className="block text-sm font-medium text-gray-700">
                SMTP Port
              </label>
              <input
                id="smtpPort"
                name="smtpPort"
                type="number"
                required
                value={formData.smtpPort}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="smtpUser" className="block text-sm font-medium text-gray-700">
                SMTP Username
              </label>
              <input
                id="smtpUser"
                name="smtpUser"
                type="text"
                required
                value={formData.smtpUser}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="smtpPassword" className="block text-sm font-medium text-gray-700">
                SMTP Password
              </label>
              <input
                id="smtpPassword"
                name="smtpPassword"
                type="password"
                required
                value={formData.smtpPassword}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="smtpFromName" className="block text-sm font-medium text-gray-700">
                From Name
              </label>
              <input
                id="smtpFromName"
                name="smtpFromName"
                type="text"
                required
                value={formData.smtpFromName}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="LLM Evaluation Platform"
              />
            </div>
            <div>
              <label htmlFor="smtpFromEmail" className="block text-sm font-medium text-gray-700">
                From Email Address
              </label>
              <input
                id="smtpFromEmail"
                name="smtpFromEmail"
                type="email"
                required
                value={formData.smtpFromEmail}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => testConnection('smtp')}
                disabled={loading}
                className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {loading ? 'Testing...' : testStatus.smtp ? '✓ Connection Verified' : 'Test Connection'}
              </button>
              <button
                type="submit"
                disabled={loading || !testStatus.smtp}
                className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </>
        );
      case 3:
        return (
          <>
            <div>
              <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700">
                Admin Email
              </label>
              <input
                id="adminEmail"
                name="adminEmail"
                type="email"
                required
                value={formData.adminEmail}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="adminPassword" className="block text-sm font-medium text-gray-700">
                Admin Password
              </label>
              <input
                id="adminPassword"
                name="adminPassword"
                type="password"
                required
                value={formData.adminPassword}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Installing...' : 'Complete Installation'}
              </button>
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">
            Installation Wizard
          </h2>
          <p className="mt-2 text-gray-600">
            {step === 1 ? 'Database Configuration' : 
             step === 2 ? 'SMTP Configuration' : 
             'Create Admin Account'}
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow rounded-lg">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {renderStep()}
          </form>
        </div>
      </div>
    </div>
  );
} 