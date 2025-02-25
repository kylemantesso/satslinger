'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function TwitterCallback() {
  const [status, setStatus] = useState('Loading...');
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const exchangeToken = async () => {
      console.log('Starting Twitter callback token exchange');
      const code = searchParams.get('code');
      const receivedState = searchParams.get('state');
      const code_verifier = localStorage.getItem('twitter_code_verifier');
      const storedState = localStorage.getItem('twitter_state');
      const returnPath = localStorage.getItem('return_to_drop');
      
      // Log all auth data
      console.log('Auth data:', {
        code: code ? 'present' : 'missing',
        receivedState,
        code_verifier: code_verifier ? 'present' : 'missing',
        storedState,
        returnPath: returnPath ? 'present' : 'missing'
      });

      if (!storedState) {
        console.error('No stored state found');
        setStatus('Authentication failed - no stored state');
        return;
      }

      if (receivedState !== storedState) {
        console.error('State mismatch:', { receivedState, storedState });
        setStatus('Authentication failed - state mismatch');
        return;
      }

      try {
        console.log('Sending request to /api/callback');
        const response = await fetch('/api/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            code,
            state: receivedState,
            code_verifier
          })
        });

        console.log('Response status:', response.status);
        
        if (!response.ok) {
          console.error('Token exchange failed with status:', response.status);
          throw new Error('Failed to exchange token');
        }

        const data = await response.json();
        console.log('Token exchange successful');
        
        // Store tokens
        localStorage.setItem('twitter_tokens', JSON.stringify({
          access_token: data.access_token,
          refresh_token: data.refresh_token
        }));
        console.log('Tokens stored in localStorage');
        
        // Clear auth data
        localStorage.removeItem('twitter_code_verifier');
        console.log('Code verifier cleared from localStorage');

        // Redirect back to drop page if available, otherwise to success page
        const redirectPath = returnPath ? `/d/${returnPath}` : '/twitter-auth/success';
        localStorage.removeItem('return_to_drop'); // Clean up
        
        console.log('Redirecting to:', redirectPath);
        router.push(redirectPath);
      } catch (error) {
        console.error('Authentication failed:', error);
        setStatus('Authentication failed');
      }
    };

    exchangeToken();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-xl font-bold mb-4">{status}</h1>
      </div>
    </div>
  );
}