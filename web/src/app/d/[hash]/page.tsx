'use client';

import { notFound } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Tweet from '@/app/components/Tweet';
import { pubKeyToAddress } from '@/utils/bitcoin';
import { initNear, CONTRACT_ID, NETWORK_ID, RPC_URL } from '@/utils/near';
import { Action, FunctionCall } from 'near-api-js/lib/transaction';
import { PublicKey, KeyPair } from 'near-api-js/lib/utils/key_pair';
import { connect, keyStores, Account } from 'near-api-js';
import { broadcastTransaction } from '@/utils/bitcoin';

type TwitterUser = {
  handle: string;
  id: string;
  secret: string;
  proof: string;
};

type Params = {
  hash: string;
};

type Drop = {
  campaign_id: number;
  target_tweet_id: number;
  amount: number;
  funder: string;
  path: string;
  keys: string[];
  op_return_hex: string | null;
  target_twitter_handle: string;
  hash: string;
  claimed: boolean;
  claimed_by: string | null;
  tweet_id: string;
}

async function getDrop(hash: string) {
  try {
    console.log('Fetching drop data for hash:', hash);
    
    // Create the request body
    const requestBody = {
      jsonrpc: '2.0',
      id: 'dontcare',
      method: 'query',
      params: {
        request_type: 'call_function',
        finality: 'final',
        account_id: CONTRACT_ID,
        method_name: 'get_drop',
        args_base64: btoa(JSON.stringify({ hash }))
      }
    };
    
    console.log('Request body:', requestBody);
    
    // Connect directly to NEAR RPC
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    console.log('Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`Failed to connect to NEAR RPC: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('RPC response:', result);
    
    if (result.error) {
      console.error('NEAR RPC error:', result.error);
      return null;
    }

    // Parse the result - NEAR returns base64 encoded JSON
    const resultBytes = result.result.result;
    console.log('Result bytes:', resultBytes);
    
    if (!resultBytes || !resultBytes.length) {
      console.log('Empty result bytes, drop may not exist');
      return null;
    }
    
    const resultString = new TextDecoder().decode(
      new Uint8Array(resultBytes.map((x: number) => x))
    );
    
    console.log('Decoded result string:', resultString);
    
    // If empty result, drop doesn't exist
    if (!resultString) {
      console.log('Empty result string after decoding');
      return null;
    }
    
    const parsedResult = JSON.parse(resultString);
    console.log('Parsed drop data:', parsedResult);
    return parsedResult;
  } catch (error) {
    console.error('Error fetching drop from NEAR:', error);
    return null;
  }
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

// Simple function to get UTXOs and select the largest one
async function getUtxoInfo(pubKey: string, amount: number) {
  try {
    // Convert public key to Bitcoin address
    const address = pubKeyToAddress(pubKey);
    console.log('Converting pubkey to address:', { pubKey, address });

    // Get UTXOs from Blockstream API
    const networkId = NETWORK_ID;
    const bitcoinRpc = `https://blockstream.info/${
      networkId === 'testnet' ? 'testnet/' : ''
    }api`;
    
    const response = await fetch(`${bitcoinRpc}/address/${address}/utxo`);
    if (!response.ok) throw new Error('Failed to fetch UTXOs');
    
    const utxos = await response.json();
    console.log('UTXOs for funder address:', utxos);

    if (!utxos || !utxos.length) {
      console.log('No UTXOs found for address', address);
      throw new Error('No UTXOs found');
    }

    // Find largest UTXO
    let maxValue = 0;
    utxos.forEach((utxo: any) => {
      if (utxo.value > maxValue) maxValue = utxo.value;
    });
    
    const filteredUtxos = utxos.filter((utxo: any) => utxo.value === maxValue);
    let selectedUtxo = filteredUtxos[0];

    // Calculate change
    const feeRateResponse = await fetch(`${bitcoinRpc}/fee-estimates`);
    const feeRate = await feeRateResponse.json();
    const estimatedSize = 1 * 148 + 2 * 34 + 10; // 1 utxo * 148
    const fee = estimatedSize * Math.ceil(feeRate[6] + 1);
    const change = selectedUtxo.value - amount - fee;
    
    console.log('Fee calculation:', {
      balance: selectedUtxo.value,
      amount,
      feeRate: feeRate[6],
      estimatedSize,
      fee,
      change
    });

    return {
      txid: selectedUtxo.txid,
      vout: selectedUtxo.vout,
      change: change > 0 ? change.toString() : '0'
    };
  } catch (e) {
    console.log('Error getting UTXO info:', e);
    throw e;
  }
}


// Add this function to check if key is authorized
async function checkAccessKey(account: Account, publicKey: string) {
  const accessKeys = await account.getAccessKeys();
  return accessKeys.find(k => k.public_key === publicKey);
}

export default function DropPage() {
  const params = useParams() as Params;
  const [drop, setDrop] = useState<Drop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [twitterUser, setTwitterUser] = useState<TwitterUser | null>(null);
  const [btcAddress, setBtcAddress] = useState<string>('');
  const [success, setSuccess] = useState<{
    message: string;
    txid: string;
    url: string;
  } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getDrop(params.hash);
        console.log(data)
        if (!data) {
          notFound();
        }
        setDrop(data);
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
    async function checkAuth() {
      try {
        setAuthLoading(true);
        const tokens = localStorage.getItem('twitter_tokens');
        if (!tokens) {
          console.log('No Twitter tokens found');
          return;
        }

        const parsedTokens = JSON.parse(tokens);

        const searchParams = new URLSearchParams({
          drop_hash: params.hash
        });

        const res = await fetch(`/api/twitter/user?${searchParams}`, {
          headers: {
            'Authorization': `Bearer ${parsedTokens.access_token}`,
            'Accept': 'application/json'
          }
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch user data: ${res.status}`);
        }

        const data = await res.json();
        setTwitterUser({
          handle: data.handle,
          id: data.id,
          proof: data.proof,
          secret: data.drop_secret_key
        });
      } catch (err) {
        console.error('Failed to check auth status:', err);
      } finally {
        setAuthLoading(false);
      }
    }

    if(drop?.target_twitter_handle) {
      checkAuth();
    }
  }, [drop]);

  // Load BTC address from localStorage on mount
  useEffect(() => {
    const savedAddress = localStorage.getItem('btcAddress');
    if (savedAddress) {
      setBtcAddress(savedAddress);
      console.log('Loaded saved BTC address:', savedAddress);
    }
  }, []);

  // Save BTC address to localStorage when it changes
  const handleBtcAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAddress = e.target.value;
    setBtcAddress(newAddress);
    localStorage.setItem('btcAddress', newAddress);
    console.log('Saved BTC address:', newAddress);
  };

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
      authUrl.searchParams.append('scope', 'users.read tweet.read');
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
    try {
      setLoading(true);
      setError(null);
      console.log('Starting claim process...');
      
      // 1. Get UTXO info
      console.log('Fetching UTXO info for funder:', drop?.funder);
      const utxoInfo = await getUtxoInfo(drop?.funder as string, drop?.amount as number);
      console.log('Got UTXO info:', utxoInfo);
      
      // 2. Get Twitter user data
      console.log('Using Twitter user data from state:', twitterUser);
      
      if (!twitterUser?.secret) {
        throw new Error('Missing Twitter verification');
      }
      
      // 3. Initialize NEAR connection
      console.log('Initializing NEAR connection...');
      const keyStore = new keyStores.InMemoryKeyStore();
      const keyPair = KeyPair.fromString(twitterUser.secret as any);
      const publicKey = keyPair.getPublicKey().toString();
      console.log('Created key pair with public key:', publicKey);
      
      // Set the key in the keyStore
      await keyStore.setKey(NETWORK_ID, CONTRACT_ID, keyPair);
      console.log('Set authorized key in keyStore for contract:', CONTRACT_ID);
      
      // Connect to NEAR
      const near = await connect({
        networkId: NETWORK_ID,
        keyStore,
        nodeUrl: RPC_URL,
      });
      
      // 4. Call the claim method
      const account = await near.account(CONTRACT_ID);
      console.log('Making contract call with args:', {
        txid_str: utxoInfo.txid,
        vout: utxoInfo.vout,
        receiver: btcAddress,
        change: utxoInfo.change,
      });
      
      // Call the claim method
      const result = await account.functionCall({
        contractId: CONTRACT_ID,
        methodName: 'claim',
        args: {
          txid_str: utxoInfo.txid,
          vout: utxoInfo.vout,
          receiver: btcAddress,
          change: utxoInfo.change,
        },
        gas: BigInt(300_000_000_000_000), // 300 TGas
      });
      
      console.log('Contract call result:', result);
      
      // 5. Extract the signed transaction
      let signedTx = null;
      
      // Look through receipt outcomes for the signed transaction
      for (const receipt of result.receipts_outcome) {
        if ((receipt.outcome.status as any).SuccessValue) {
          const decodedValue = Buffer.from((receipt.outcome.status as any).SuccessValue, 'base64').toString();
          
          // Look for hex string that looks like a Bitcoin transaction
          if (decodedValue.startsWith('"01') && decodedValue.endsWith('"')) {
            signedTx = decodedValue.replace(/^"|"$/g, '');
            console.log('Found signed transaction in receipt');
            break;
          }
        }
      }
      
      if (!signedTx) {
        throw new Error('No signed transaction found in result');
      }
      
      // 6. Broadcast the transaction
      console.log('Broadcasting signed transaction:', signedTx);
      const txHash = await broadcastTransaction(signedTx);
      
      // Add this: Fetch the updated drop status
      const updatedDrop = await getDrop(params.hash);
      setDrop(updatedDrop);
      
      setSuccess({
        message: 'Successfully claimed Bitcoin!',
        txid: txHash,
        url: `https://blockstream.info/testnet/tx/${txHash}`
      });
      
    } catch (error: any) {
      console.error('Error in claim process:', error);
      setError(error.message || 'Failed to claim');
    } finally {
      setLoading(false);
    }
  };

  // Add effect to handle transaction result
  useEffect(() => {
    const checkTransaction = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const transactionHashes = urlParams.get('transactionHashes');

      if (transactionHashes) {
        try {
          // Initialize NEAR connection
          const { near } = await initNear();
          
          // Get transaction result
          const result = await near.connection.provider.txStatus(
            transactionHashes,
            CONTRACT_ID,
            'FINAL'
          );

          if ((result.status as any).SuccessValue) {
            const signedTx = Buffer.from((result.status as any).SuccessValue, 'base64').toString();
            
            // Broadcast to Bitcoin network
            const broadcastResponse = await fetch(`https://mempool.space/${NETWORK_ID === 'mainnet' ? '' : 'testnet/'}api/tx`, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain' },
              body: signedTx
            });

            const txid = await broadcastResponse.text();
            
            setSuccess({
              message: 'Successfully claimed your sats!',
              txid,
              url: `https://mempool.space/${NETWORK_ID === 'mainnet' ? '' : 'testnet/'}tx/${txid}`
            });

            // Refresh drop data
            const updatedDrop = await getDrop(params.hash);
            setDrop(updatedDrop);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to process transaction');
        } finally {
          setLoading(false);
        }
      }
    };

    checkTransaction();
  }, [params.hash]); // Run when hash changes or on mount

  // Add this polling effect after a successful transaction
  useEffect(() => {
    if (success) {
      const pollInterval = setInterval(async () => {
        const updatedDrop = await getDrop(params.hash);
        // Check if keys array is empty, indicating the drop has been claimed
        if (updatedDrop && (!updatedDrop.keys || updatedDrop.keys.length === 0)) {
          setDrop(updatedDrop);
          clearInterval(pollInterval);
        }
      }, 5000); // Poll every 5 seconds
      
      // Clear interval on component unmount
      return () => clearInterval(pollInterval);
    }
  }, [success, params.hash]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <div className="animate-bounce text-2xl">🤠 Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-xl text-red-600 border-2 border-red-200 rounded-lg p-6 bg-white shadow-lg">
          🌵 Whoops! {error}
        </div>
      </div>
    );
  }

  const isOwner = twitterUser?.handle === drop?.target_twitter_handle;
  const isDropClaimed = !drop?.keys || drop.keys.length === 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-50 to-amber-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl max-w-[680px] w-full border-2 border-amber-200">
        <div className="text-center mb-8 space-y-4">
          <div className="text-6xl mb-2">🤠</div>
          <h1 className="text-4xl font-bold mb-4 text-amber-900 font-serif">Howdy Partner!</h1>
          <div className="border-b-2 border-dashed border-amber-200 w-1/2 mx-auto mb-4"></div>
          
          <div className="prose text-amber-800 max-w-none">
            <p className="text-lg mb-4">
              Meet <a 
                href="https://x.com/SatSlinger" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-amber-600 hover:text-amber-700 font-semibold no-underline"
              >@SatSlinger</a>, the fastest Bitcoin-tipping bot in the Wild West! 🌵
            </p>
            <p className="text-md mb-6">
              Like a trusty sheriff on the digital frontier, <a 
                href="https://x.com/SatSlinger" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-amber-600 hover:text-amber-700 font-semibold no-underline"
              >@SatSlinger</a> roams X rewarding the finest posts 
              with Bitcoin sats. Powered by the NEAR Protocol, we're bringing Bitcoin rewards to social media, 
              one yeehaw at a time! 🤠💰
            </p>
          </div>
        </div>

        {/* Status Box */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-6 rounded-lg border-2 border-amber-200 shadow-md mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-sm uppercase tracking-wide text-amber-800 mb-1">Reward Amount</h2>
              <p className="text-3xl font-bold text-amber-600">{drop?.amount} sats</p>
            </div>
            <div className="text-right">
              <h2 className="text-sm uppercase tracking-wide text-amber-800 mb-1">Status</h2>
              <p className={`text-xl ${isDropClaimed ? 'text-green-600' : 'text-blue-600'}`}>
                {isDropClaimed ? '🎯 Claimed' : '🌟 Available'}
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-sm uppercase tracking-wide text-amber-800 mb-1">Reserved For</h2>
            <p className="text-xl font-mono">@{drop?.target_twitter_handle}</p>
          </div>

          {!isDropClaimed && authLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-amber-100 rounded w-3/4"></div>
              <div className="h-10 bg-amber-100 rounded"></div>
            </div>
          ) : !isDropClaimed && !twitterUser ? (
            <>
              <p className="text-amber-900 mb-6">
                Hold your horses, partner! We need to verify you're the rightful owner of these sats. 
                Connect your X (Twitter) account to claim your reward.
              </p>
              <button
                onClick={handleTwitterLogin}
                className="w-full bg-black text-white py-4 px-6 rounded-lg text-lg font-bold 
                         hover:bg-gray-900 transition-all transform hover:scale-105 
                         flex items-center justify-center gap-2 shadow-lg"
              >
                𝕏 Connect X Account
              </button>
            </>
          ) : !isDropClaimed && twitterUser && !isOwner ? (
            <div className="text-red-800 bg-red-50 p-4 rounded-lg border border-red-200">
              <p>
                Looks like these sats are reserved for <strong>@{drop?.target_twitter_handle}</strong>, 
                but you're logged in as @{twitterUser.handle} on X. 
                Make sure you're logged in with the right account!
              </p>
            </div>
          ) : !isDropClaimed && twitterUser && isOwner ? (
            <div className="space-y-4">
              <p className="text-amber-900">
                Well butter my biscuit, you're verified! Just drop your Bitcoin address below 
                and we'll send those sats riding your way!
              </p>
              <div className="space-y-2">
                <input
                  type="text"
                  value={btcAddress}
                  onChange={handleBtcAddressChange}
                  className="w-full p-4 border-2 border-amber-200 rounded-lg 
                           focus:ring-2 focus:ring-amber-500 focus:border-amber-500
                           bg-white shadow-inner"
                  placeholder="Enter your Bitcoin address (bc1q...)"
                  disabled={loading}
                />
                <button
                  onClick={handleClaim}
                  disabled={loading || !btcAddress}
                  className={`w-full bg-gradient-to-r from-amber-500 to-orange-500 
                             text-white py-4 px-6 rounded-lg text-lg font-bold
                             transition-all transform hover:scale-105
                             flex items-center justify-center gap-2 shadow-lg
                             ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:from-amber-600 hover:to-orange-600'}`}
                >
                  {loading ? (
                    <>
                      <span className="animate-spin">🤠</span>
                      Claiming...
                    </>
                  ) : (
                    <>🎯 Claim Your {drop?.amount} Sats</>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-green-800">
              Yeehaw! These sats have already been claimed and are riding off into the sunset! 
              Keep posting on X for more chances to earn Bitcoin rewards! 
            </p>
          )}
        </div>

        {/* Winning Tweet */}
        <div className="bg-white rounded-lg overflow-hidden shadow-md border border-amber-200">
          <div className="p-4 bg-amber-50 border-b border-amber-200">
            <h2 className="text-amber-800 font-semibold">🏆 Winning X Post</h2>
          </div>
          {drop && <Tweet id={drop?.target_tweet_id.toString()} />}
        </div>

        {/* Technical Details */}
        <div className="mt-8 text-xs text-amber-700 space-y-2 bg-amber-50 p-4 rounded-lg border border-amber-200">
          <p className="font-mono">Drop ID: {drop?.hash}</p>
          <p className="font-mono break-all">Public Key: {drop?.keys[0]}</p>
        </div>

        {success && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 mb-2">{success.message}</p>
            <a 
              href={success.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 hover:text-green-700 underline"
            >
              View Transaction 🔍
            </a>
          </div>
        )}
      </div>
    </div>
  );
} 