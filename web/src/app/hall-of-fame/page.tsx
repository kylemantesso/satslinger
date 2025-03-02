'use client';

import { useState, useEffect } from 'react';
import Tweet from '@/app/components/Tweet';
import { RPC_URL, CONTRACT_ID } from '@/utils/near';

type Drop = {
  campaign_id: number;
  target_tweet_id: string;
  amount: number;
  target_twitter_handle: string;
  hash: string;
  claimed: boolean;
  created_at: number;
};

export default function HallOfFame() {
  const [drops, setDrops] = useState<Drop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(5); // Initially show 5 items

  useEffect(() => {
    async function loadDrops() {
      try {
        // Connect to NEAR RPC to get all drops
        const response = await fetch(RPC_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'dontcare',
            method: 'query',
            params: {
              request_type: 'call_function',
              finality: 'final',
              account_id: CONTRACT_ID,
              method_name: 'get_all_drops',
              args_base64: btoa('{}')
            }
          })
        });

        if (!response.ok) {
          throw new Error('Failed to connect to NEAR RPC');
        }

        const result = await response.json();
        
        if (result.error) {
          console.error('NEAR RPC error:', result.error);
          return;
        }

        // Parse the result
        const resultBytes = result.result.result;
        const resultString = new TextDecoder().decode(
          new Uint8Array(resultBytes.map((x: number) => x))
        );
        
        // Parse and sort drops by most recent first
        const drops = JSON.parse(resultString);
        const sortedDrops = drops.sort((a: Drop, b: Drop) => b.created_at - a.created_at);
        setDrops(sortedDrops);
      } catch (err) {
        console.error('Error fetching drops:', err);
        setError('Failed to load drops');
      } finally {
        setLoading(false);
      }
    }

    loadDrops();
  }, []);

  // Function to load more items
  const loadMore = () => {
    setVisibleCount(prevCount => prevCount + 5);
  };

  // Get only the visible drops
  const filteredDrops = drops.reverse().filter((drop) => drop.target_twitter_handle !== "kylemantesso");
  const visibleDrops = filteredDrops.slice(0, visibleCount);
  
  // Check if there are more drops to show
  const hasMoreDrops = visibleCount < filteredDrops.length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <div className="animate-bounce text-2xl">🤠 Loading the Hall of Fame...</div>
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-amber-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12 space-y-4">
          <div className="text-6xl mb-2">🤠</div>
          <h1 className="text-4xl font-bold text-amber-900 font-rye">SatSlinger's Hall of Fame</h1>
          <div className="border-b-2 border-dashed border-amber-200 w-1/2 mx-auto mb-4"></div>
          <p className="text-lg text-amber-800">
            Welcome to our Hall of Fame! These fine folks struck gold with their outstanding posts. 
            Each one earned themselves a mighty fine reward in Bitcoin sats! 🎯
          </p>
        </div>

        <div className="space-y-8">
          {visibleDrops.map((drop, index) => (
            <div 
              key={drop.hash}
              className="bg-white rounded-xl shadow-lg border-2 border-amber-200 overflow-hidden relative"
            >
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-semibold text-amber-900">
                      @{drop.target_twitter_handle}
                    </h2>
                    <p className="text-sm text-amber-700">
                      Earned {drop.amount} sats
                    </p>
                  </div>
                  <div>
                    <a
                      href={`/d/${drop.hash}`}
                      className="text-amber-600 hover:text-amber-700 text-sm font-medium"
                    >
                      View Drop 🎯
                    </a>
                  </div>
                </div>
              </div>
              
              <div className="p-4">
                <Tweet id={drop.target_tweet_id} />
              </div>

              <div className="px-4 py-3 bg-amber-50 border-t border-amber-200">
                <p className="text-sm text-amber-700">
                  Status: {drop.claimed ? '🎯 Claimed' : '🌟 Available'}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Load More Button */}
        {hasMoreDrops && (
          <div className="text-center mt-8">
            <button
              onClick={loadMore}
              className="inline-flex items-center px-6 py-3 bg-amber-100 text-amber-900 rounded-lg hover:bg-amber-200 transition-colors font-bold shadow-md"
            >
              🤠 View More Rewards
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 