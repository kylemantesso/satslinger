'use client';

import { BitteWalletContextProvider, useBitteWallet, Wallet } from "@bitte-ai/react";
import { BitteAiChat } from "@bitte-ai/chat";
import { useEffect, useState } from "react";

const chatColors = {
    generalBackground: '#fff7ed',
    messageBackground: '#fef3c7', 
    textColor: '#78350f',
    buttonColor: '#d97706',
    borderColor: '#fcd34d',
};

// Component that uses the wallet hook
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
            apiUrl="/api/ai-plugin"
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

export default function ChatComponent() {
    return (
        <BitteWalletContextProvider>
            <AgentChat />
        </BitteWalletContextProvider>
    );
} 