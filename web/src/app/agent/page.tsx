'use client';
import { useEffect, useState } from "react";
import dynamic from 'next/dynamic';

const ChatComponent = dynamic(
    () => import('./ChatComponent'),
    { ssr: false }
);

const chatColors = {
  generalBackground: '#fff7ed', // orange-50
  messageBackground: '#fef3c7', // amber-100
  textColor: '#78350f', // amber-900
  buttonColor: '#d97706', // amber-600
  borderColor: '#fcd34d', // amber-300
};

// Main page component
export default function AgentPage() {
    const [infoExpanded, setInfoExpanded] = useState(true);

    return (
        <div className="min-h-screen bg-gradient-to-b from-orange-50 to-amber-100">
            {/* Banner Section */}
            <div className="w-full bg-gradient-to-b from-sky-200 to-orange-50 pb-4">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center pt-12">
                        <h1 className="text-4xl font-bold text-amber-900 mb-4 font-rye">🤠 Satslinger</h1>
                        <h2 className="text-1xl font-medium text-amber-800 mb-6">
                            Promote your project with our AI agent!
                        </h2>
                        <div className="inline-block bg-amber-100 border-2 border-amber-300 rounded-full px-4 py-2 text-amber-800">
                            <a href="https://devpost.com/software/saslinger" 
                               target="_blank" 
                               rel="noopener noreferrer" 
                               className="hover:underline">
                                🏆 Entry in NEAR Protocol's One Trillion Agents Hackathon
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Box */}
            <div className="max-w-4xl mx-auto px-4 mt-6 mb-3">
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 shadow-md">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-bold text-amber-900 font-rye">How to Use SatSlinger Agent</h3>
                        <button 
                            onClick={() => setInfoExpanded(!infoExpanded)}
                            className="text-amber-700 hover:text-amber-900"
                        >
                            {infoExpanded ? '▲ Hide' : '▼ Show'}
                        </button>
                    </div>
                    
                    {infoExpanded && (
                        <div className="text-amber-800 space-y-2 text-sm md:text-base">
                            <p><span className="font-bold">1.</span> 🤠 Connect your NEAR wallet when prompted</p>
                            <p><span className="font-bold">2.</span> 🐎 Tell the agent what content you want to promote (e.g., "I want to reward tweets about NEAR Protocol NFTs")</p>
                            <p><span className="font-bold">3.</span> 🌵 Provide your campaign details when asked - hashtags and your Twitter handle</p>
                            <p><span className="font-bold">4.</span> 💰 Fund your campaign with Bitcoin by sending to the provided address</p>
                            <p><span className="font-bold">5.</span> 🤑 SatSlinger will automatically find and reward the best content with Bitcoin tips!</p>
                            <div className="text-xs text-amber-700 mt-3 border-t border-amber-200 pt-2">
                                <p>🤔 Note: You'll need a NEAR wallet (MyNearWallet or Meteor) to create campaigns</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Section */}
            <div className="max-w-4xl mx-auto px-4 py-4">
                <div className="bg-white rounded-xl shadow-xl border-2 border-amber-200 overflow-hidden">
                    <ChatComponent />
                </div>
            </div>

            {/* Footer */}
            <footer className="text-center text-amber-700 pb-8">
                <p>
                    Powered by NEAR Protocol & Bitcoin 
                    <span className="mx-2">•</span>
                    Bringing Web3 to the Wild West 🤠
                </p>
            </footer>
        </div>
    );
}