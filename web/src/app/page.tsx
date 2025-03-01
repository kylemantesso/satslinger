'use client';

import { useEffect, useState } from 'react';
import Image from "next/image";

type RewardedTweet = {
  id: string;
  text: string;
  author: string;
  amount: number;
  timestamp: string;
};

export default function Home() {
  const [recentRewards, setRecentRewards] = useState<RewardedTweet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch recent rewards
    async function fetchRecentRewards() {
      try {
        const response = await fetch('/api/recent-rewards');
        const data = await response.json();
        setRecentRewards(data);
      } catch (error) {
        console.error('Failed to fetch recent rewards:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchRecentRewards();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-amber-100">
      {/* Banner Section */}
      <div className="w-full bg-gradient-to-b from-sky-200 to-orange-50 pb-8">
        <div className="max-w-5xl mx-auto">
          <Image
            src="/banner.png"
            alt="Satslinger - Built on NEAR"
            width={1200}
            height={400}
            priority
            className="w-full h-auto shadow-xl"
          />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-amber-900 mb-4 font-serif">
            Howdy, Partner!
          </h1>
          <p className="text-xl text-amber-800 mb-8">
            Welcome to the wildest Bitcoin-tipping saloon on the digital frontier!
          </p>
          
          {/* Hackathon Badge */}
          <div className="inline-block bg-amber-100 border-2 border-amber-300 rounded-full px-4 py-2 text-amber-800">
            <a href="https://devpost.com/software/saslinger" target="_blank" rel="noopener noreferrer" className="hover:underline">
              🏆 Entry in NEAR Protocol's One Trillion Agents Hackathon
            </a>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-2xl p-8 border-2 border-amber-200">
          <div className="prose prose-lg max-w-none text-amber-800">
            <h2 className="text-3xl font-bold text-amber-900 mb-6">
              What in Tarnation is SatSlinger? 🌵
            </h2>
            
            <p className="mb-6">
              Like a trusty sheriff patrolling the digital plains, SatSlinger roams 
              X rewarding the finest posts with Bitcoin sats using 
              NEAR Protocol's Chain Signatures. We're bringing Wild West justice to 
              social media, one tip at a time!
            </p>

            <div className="border-b-2 border-dashed border-amber-200 my-8"></div>

            <h3 className="text-2xl font-bold text-amber-900 mb-4">
              How It Works 
            </h3>

            <div className="grid gap-6 md:grid-cols-3 mb-8">
              <div className="bg-amber-50 p-6 rounded-lg">
                <div className="text-4xl mb-2">🔍</div>
                <h4 className="font-bold mb-2">Scout</h4>
                <p className="text-sm">
                  We scout the territory for the most engaging posts on X
                </p>
              </div>
              
              <div className="bg-amber-50 p-6 rounded-lg">
                <div className="text-4xl mb-2">💰</div>
                <h4 className="font-bold mb-2">Reward</h4>
                <p className="text-sm">
                  Top posts get rewarded with Bitcoin sats
                </p>
              </div>
              
              <div className="bg-amber-50 p-6 rounded-lg">
                <div className="text-4xl mb-2">🎉</div>
                <h4 className="font-bold mb-2">Claim</h4>
                <p className="text-sm">
                  Creators claim their rewards faster than a quick-draw!
                </p>
              </div>
            </div>

            <div className="border-b-2 border-dashed border-amber-200 my-8"></div>

            <div className="text-center">
              <h3 className="text-2xl font-bold text-amber-900 mb-4">
                Ready to Join the Posse? 🌟
              </h3>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                <a
                  href="https://x.com/SatSlinger"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <span className="mr-2">𝕏</span>
                  Follow @SatSlinger
                </a>
                
                <a
                  href="https://devpost.com/software/saslinger"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                >
                  🚀 View on Devpost
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Rewards Section */}
        <div className="mt-16 bg-white rounded-xl shadow-2xl p-8 border-2 border-amber-200">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-amber-900 mb-2">
              Latest Rewards 🎯
            </h2>
            <p className="text-amber-800">
              Check out the most recent posts that struck gold!
            </p>
          </div>

          {loading ? (
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-amber-50 p-4 rounded-lg">
                  <div className="h-4 bg-amber-100 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-amber-100 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-4 mb-8">
                {recentRewards.map((tweet) => (
                  <a
                    key={tweet.id}
                    href={`https://x.com/i/status/${tweet.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-amber-50 p-4 rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-amber-900">@{tweet.author}</span>
                      <span className="text-amber-700">{tweet.amount} sats</span>
                    </div>
                    <p className="text-amber-800 text-sm">{tweet.text}</p>
                    <div className="text-xs text-amber-600 mt-2">
                      {new Date(tweet.timestamp).toLocaleDateString()}
                    </div>
                  </a>
                ))}
              </div>

              <div className="text-center">
                <a
                  href="/hall-of-fame"
                  className="inline-flex items-center px-6 py-3 bg-amber-100 text-amber-900 rounded-lg hover:bg-amber-200 transition-colors"
                >
                  🏆 View Hall of Fame
                </a>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-amber-700">
          <p>
            Built for the NEAR Protocol One Trillion Agents Hackathon
            <span className="mx-2">•</span>
            Powered by NEAR Protocol & Bitcoin 
            <span className="mx-2">•</span>
            Bringing Web3 to the Wild West 🤠
          </p>
        </footer>
      </div>
    </div>
  );
}
