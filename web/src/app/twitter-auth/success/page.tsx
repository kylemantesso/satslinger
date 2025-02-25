'use client';

import { useState, useEffect } from 'react';

export default function SuccessPage() {
  const [tokens, setTokens] = useState<{ access_token?: string, refresh_token?: string }>();
  const [tweetText, setTweetText] = useState('Hello from SatSlinger! 🤠');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [showTokens, setShowTokens] = useState(false);

  useEffect(() => {
    // Get tokens from localStorage that were saved in callback
    const savedTokens = localStorage.getItem('twitter_tokens');
    if (savedTokens) {
      setTokens(JSON.parse(savedTokens));
    }
  }, []);

  const sendTweet = async () => {
    if (!tokens?.access_token) {
      setError('No access token found');
      return;
    }

    setStatus('Sending tweet...');
    setError('');

    try {
      const response = await fetch('/api/twitter/tweet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: tweetText,
          access_token: tokens.access_token
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send tweet');
      }

      const data = await response.json();
      setStatus('Tweet sent successfully!');
      console.log('Tweet response:', data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send tweet');
      setStatus('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-[600px]">
        <h1 className="text-2xl font-bold mb-6">Test Your Twitter Integration</h1>
        
        <div className="mb-6">
          <button
            onClick={() => setShowTokens(!showTokens)}
            className="mb-2 text-blue-500 hover:text-blue-700"
          >
            {showTokens ? 'Hide' : 'Show'} Tokens
          </button>
          
          {showTokens && tokens && (
            <div className="bg-gray-50 p-4 rounded border">
              <div className="mb-4">
                <h3 className="font-bold mb-1">Access Token:</h3>
                <div className="break-all bg-gray-100 p-2 rounded text-sm">
                  {tokens.access_token}
                </div>
              </div>
              <div>
                <h3 className="font-bold mb-1">Refresh Token:</h3>
                <div className="break-all bg-gray-100 p-2 rounded text-sm">
                  {tokens.refresh_token}
                </div>
              </div>
            </div>
          )}
        </div>
        
        <textarea
          value={tweetText}
          onChange={(e) => setTweetText(e.target.value)}
          className="w-full p-2 border rounded mb-4 h-24"
          placeholder="Enter your tweet text"
        />

        <button
          onClick={sendTweet}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors"
        >
          Send Test Tweet
        </button>

        {status && (
          <div className="mt-4 p-3 bg-green-100 text-green-700 rounded">
            {status}
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}
      </div>
    </div>
  );
} 