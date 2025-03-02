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
    return (
        <div className="min-h-screen bg-gradient-to-b from-orange-50 to-amber-100">
            {/* Banner Section */}
            <div className="w-full bg-gradient-to-b from-sky-200 to-orange-50 pb-4">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center pt-12">
                        <h1 className="text-4xl font-bold text-amber-900 mb-4">🤠 Satslinger</h1>
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