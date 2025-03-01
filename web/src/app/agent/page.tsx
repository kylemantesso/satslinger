'use client';
import { BitteWalletContextProvider, useBitteWallet, Wallet } from "@bitte-ai/react";
import { BitteAiChat } from "@bitte-ai/chat";
import { useEffect, useState } from "react";

const chatColors = {
  generalBackground: '#fff7ed', // orange-50
  messageBackground: '#fef3c7', // amber-100
  textColor: '#78350f', // amber-900
  buttonColor: '#d97706', // amber-600
  borderColor: '#fcd34d', // amber-300
};

// Separate component that uses the wallet hook
function AgentChat() {
    const { selector } = useBitteWallet();
    const [wallet, setWallet] = useState<Wallet>();

    useEffect(() => {
        const fetchWallet = async () => {
            const walletInstance = await selector.wallet();
            setWallet(walletInstance);
        };
        if (selector) fetchWallet();
    }, [selector]);

    return (
        <BitteAiChat 
            agentId="satslinger"
            apiUrl="/api/agent"
            wallet={{ near: { wallet } }}
            options={{
                agentName: "SatSlinger", 
                agentImage: "/satslinger.png",
                welcomeMessageComponent: (
                    <div className="flex items-start gap-4">
                        <div className="text-6xl">🌵</div>
                        <div className="flex flex-col gap-2">
                            <p className="text-lg font-semibold text-amber-900">
                                Howdy partner! 🤠
                            </p>
                            <p className="text-amber-800">
                                I'm SatSlinger, the fastest Bitcoin-tipping bot in the Wild West! Just tell me your search terms and Twitter handle, and I'll help you reward the finest NEAR Protocol content with Bitcoin tips faster than a tumbleweed in a tornado! 🌟
                            </p>
                            <p className="text-amber-800 mt-2">
                                What can I help you with today, partner?
                            </p>
                        </div>
                    </div>
                ),
                colors: chatColors
            }}
        />
    );
}

// Main page component that provides the context
export default function AgentPage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-orange-50 to-amber-100">
            {/* Banner Section */}
            <div className="w-full bg-gradient-to-b from-sky-200 to-orange-50 pb-8">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center pt-12">
                        <h1 className="text-4xl font-bold text-amber-900 mb-4">🤠 SatSlinger Agent</h1>
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
            <div className="max-w-4xl mx-auto px-4 py-8 sm:py-16">
                <div className="bg-white rounded-xl shadow-xl border-2 border-amber-200 overflow-hidden">
                    <BitteWalletContextProvider>
                        <AgentChat />
                    </BitteWalletContextProvider>
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