'use client';

import { notFound } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

type TwitterUser = {
  handle: string;
  id: string;
};

type Params = {
  hash: string;
};

async function getDrop(hash: string) {
  // Use BASE_URL since this is a server component
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/drops/${hash}`, {
    next: { revalidate: 60 } // Cache for 1 minute
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error('Failed to fetch drop');
  }

  return res.json();
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

function base64URLEncode(buffer: Uint8Array | ArrayBuffer): string {
  const array = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(hash);
}

export default function DropPage() {
  const params = useParams() as Params;
  const [drop, setDrop] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [twitterUser, setTwitterUser] = useState<TwitterUser | null>(null);
  const [btcAddress, setBtcAddress] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getDrop(params.hash);
        if (!data) {
          notFound();
        }
        setDrop(data.drop);
      } catch (err) {
        setError('Failed to load drop details');
      } finally {
        setLoading(false);
      }
    }

    if (params.hash) {
      loadData();
    }
  }, [params.hash]);

  useEffect(() => {
    // Check if user is already authenticated
    async function checkAuth() {
      try {
        const tokens = localStorage.getItem('twitter_tokens');
        if (!tokens) {
          console.log('No Twitter tokens found');
          return;
        }

        let parsedTokens;
        try {
          parsedTokens = JSON.parse(tokens);
          console.log('Found stored tokens:', {
            access_token: parsedTokens.access_token ? 'present' : 'missing',
            refresh_token: parsedTokens.refresh_token ? 'present' : 'missing'
          });
        } catch (parseError) {
          console.error('Failed to parse stored tokens:', parseError);
          return;
        }

        // Get user details with proof using the author_handle from drop data
        const res = await fetch(`/api/twitter/user/${drop.author_handle}`, {
          headers: {
            'Authorization': `Bearer ${parsedTokens.access_token}`,
            'Accept': 'application/json'
          }
        });

        console.log('User API response status:', res.status);
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error('User API error:', errorText);
          throw new Error(`Failed to fetch user data: ${res.status}`);
        }

        const data = await res.json();
        console.log('Received user data:', data);
        setTwitterUser(data);
      } catch (err) {
        console.error('Failed to check auth status:', err);
      }
    }

    checkAuth();

  }, [drop]);

  const handleTwitterLogin = async () => {
    try {
      console.log('Initiating Twitter login...');
      
      // Generate PKCE values
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = base64URLEncode(crypto.getRandomValues(new Uint8Array(16)));

      // Store values in localStorage
      localStorage.setItem('return_to_drop', params.hash);
      localStorage.setItem('twitter_code_verifier', codeVerifier);
      localStorage.setItem('twitter_state', state);

      // Log what we're storing
      console.log('Storing auth data:', {
        return_path: params.hash,
        code_verifier: codeVerifier.slice(0, 10) + '...',
        state
      });

      // Build Twitter OAuth URL
      const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('client_id', process.env.NEXT_PUBLIC_TWITTER_CLIENT_ID!);
      authUrl.searchParams.append('redirect_uri', process.env.NEXT_PUBLIC_TWITTER_CALLBACK_URL!);
      authUrl.searchParams.append('scope', 'users.read tweet.read offline.access');
      authUrl.searchParams.append('code_challenge', codeChallenge);
      authUrl.searchParams.append('code_challenge_method', 'S256');
      authUrl.searchParams.append('state', state);

      // Verify data was stored
      const storedState = localStorage.getItem('twitter_state');
      const storedVerifier = localStorage.getItem('twitter_code_verifier');
      console.log('Verified stored data:', {
        state: storedState === state ? 'matches' : 'missing',
        verifier: storedVerifier === codeVerifier ? 'matches' : 'missing'
      });

      // Only redirect if storage was successful
      if (storedState && storedVerifier) {
        console.log('Redirecting to Twitter auth URL:', authUrl.toString());
        window.location.href = authUrl.toString();
      } else {
        throw new Error('Failed to store auth data');
      }
    } catch (error) {
      console.error('Failed to initiate Twitter login:', error);
      setError('Failed to connect to Twitter');
    }
  };

  const handleClaim = async () => {
    if (!btcAddress) {
      setError('Please enter a Bitcoin address');
      return;
    }

    try {
      const response = await fetch('/api/drops/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hash: params.hash,
          btcAddress
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to claim drop');
      }

      // Refresh drop data to show claimed status
      const data = await getDrop(params.hash);
      setDrop(data.drop);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim drop');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;
  }

  const isOwner = twitterUser?.handle === drop.author_handle;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-[600px]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">🤠 Howdy Partner!</h1>
          <p className="text-lg text-gray-600">
            Welcome to your Bitcoin drop from SatSlinger! You've earned yourself a mighty fine reward for your tweet.
          </p>
        </div>
        
        <div className="space-y-6">
          <div>
            <h2 className="font-semibold text-gray-600">Your Reward</h2>
            <p className="text-3xl font-bold text-orange-500">{drop.amount} sats</p>
          </div>

          <div>
            <h2 className="font-semibold text-gray-600">Reserved For</h2>
            <p className="text-lg">@{drop.author_handle}</p>
          </div>

          <div>
            <h2 className="font-semibold text-gray-600">Status</h2>
            <p className={`text-lg ${drop.claimed ? 'text-green-600' : 'text-blue-600'}`}>
              {drop.claimed ? '🎯 Claimed' : '🌟 Available'}
            </p>
          </div>

          {!drop.claimed && !twitterUser && (
            <div className="space-y-4 bg-orange-50 p-6 rounded-lg border border-orange-200">
              <h3 className="text-xl font-bold text-orange-700">
                🌵 First Step: Verify Your Twitter Account
              </h3>
              <p className="text-gray-700">
                Hold your horses, partner! We need to make sure you're the rightful owner of these sats. 
                Click below to verify your Twitter account.
              </p>
              <button
                onClick={handleTwitterLogin}
                className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg text-lg font-semibold hover:bg-blue-600 transition-colors"
              >
                🐦 Connect Twitter Account
              </button>
            </div>
          )}

          {!drop.claimed && twitterUser && !isOwner && (
            <div className="bg-red-50 p-6 rounded-lg border border-red-200">
              <h3 className="text-xl font-bold text-red-700">
                🚫 Whoa There, Partner!
              </h3>
              <p className="text-gray-700">
                Looks like these sats are reserved for @{drop.author_handle}, but you're logged in as @{twitterUser.handle}. 
                Make sure you're logged in with the right account!
              </p>
            </div>
          )}

          {!drop.claimed && twitterUser && isOwner && (
            <div className="space-y-4 bg-orange-50 p-6 rounded-lg border border-orange-200">
              <h3 className="text-xl font-bold text-orange-700">
                🌵 How to Claim Your Sats
              </h3>
              <p className="text-gray-700">
                Well butter my biscuit, you're verified! Just drop your Bitcoin address below and we'll send those sats riding your way!
              </p>
              
              <div className="space-y-2">
                <label htmlFor="btcAddress" className="block text-sm font-medium text-gray-700">
                  Your Bitcoin Address
                </label>
                <input
                  type="text"
                  id="btcAddress"
                  value={btcAddress}
                  onChange={(e) => setBtcAddress(e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="bc1q..."
                />
                <p className="text-sm text-gray-500">
                  Make sure it's a valid Bitcoin address, partner! No take-backs on the blockchain trail! 🤠
                </p>
              </div>

              <button
                onClick={handleClaim}
                className="w-full bg-orange-500 text-white py-3 px-4 rounded-lg text-lg font-semibold hover:bg-orange-600 transition-colors"
              >
                🎯 Claim Your {drop.amount} Sats
              </button>
            </div>
          )}

          {drop.claimed && (
            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
              <h3 className="text-xl font-bold text-green-700 mb-2">
                🎉 These Sats Have Found Their Home!
              </h3>
              <p className="text-gray-700">
                Yeehaw! These sats have already been claimed and are riding off into the sunset! Keep tweeting for more chances to earn Bitcoin rewards! 
              </p>
            </div>
          )}

          <div className="mt-6 text-sm text-gray-500 space-y-1">
            <p>Created: {new Date(drop.created_at).toLocaleString()}</p>
            <p className="break-all">Public Key: {drop.public_key}</p>
          </div>
        </div>
      </div>
    </div>
  );
} 