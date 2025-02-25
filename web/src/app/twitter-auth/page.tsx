'use client';

import { useState } from 'react';

export default function TwitterAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/twitter/request-token', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to initiate login');
      }

      const { url, code_verifier } = await response.json();
      
      // Store code_verifier securely (e.g., in localStorage for now)
      localStorage.setItem('twitter_code_verifier', code_verifier);
      
      // Redirect to Twitter
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6">Twitter Authentication</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <button
          onClick={handleLogin}
          disabled={loading}
          className={`w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors
            ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {loading ? 'Connecting...' : 'Connect with Twitter'}
        </button>
      </div>
    </div>
  );
} 