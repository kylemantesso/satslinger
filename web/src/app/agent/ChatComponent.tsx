'use client';

import { BitteAiChat } from "@bitte-ai/chat";
import { setupWalletSelector } from "@near-wallet-selector/core";
import { setupModal } from "@near-wallet-selector/modal-ui";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { useEffect, useState } from "react";
import type { WalletSelector } from "@near-wallet-selector/core";
import "@near-wallet-selector/modal-ui/styles.css";
import { CONTRACT_ID } from '@/utils/near';

const chatColors = {
    generalBackground: '#fff7ed',
    messageBackground: '#fef3c7', 
    textColor: '#78350f',
    buttonColor: '#d97706',
    borderColor: '#fcd34d',
};

function AgentChat() {
    const [selector, setSelector] = useState<WalletSelector>();
    const [modal, setModal] = useState<any>(null);
    const [wallet, setWallet] = useState<any>(null);
    const [isConnecting, setIsConnecting] = useState(false);

    useEffect(() => {
        setupWalletSelector({
            network: process.env.NEXT_PUBLIC_NEAR_NETWORK_ID === 'mainnet' ? 'mainnet' : 'testnet',
            modules: [setupMyNearWallet()]
        }).then((selector) => {
            setSelector(selector);
            const modal = setupModal(selector, {
                contractId: CONTRACT_ID,
                description: "Please select a wallet to connect to SatSlinger"
            });
            setModal(modal);
        });
    }, []);

    useEffect(() => {
        if (!selector) return;

        selector.wallet().then((wallet) => {
            setWallet(wallet);
        });
    }, [selector]);

    const handleConnect = async () => {
        setIsConnecting(true);
        try {
            await modal.show();
            await selector?.wallet().then(setWallet);
        } catch (err) {
            console.error('Failed to connect wallet:', err);
        } finally {
            setIsConnecting(false);
        }
    };

    if (!wallet) {
        return (
            <div className="flex flex-col items-center justify-center p-8 gap-4">
                <div className="text-6xl">🤠</div>
                <h2 className="text-xl font-semibold text-amber-900">
                    Howdy Partner!
                </h2>
                <p className="text-amber-800 text-center max-w-md">
                    To start slinging Bitcoin rewards for NEAR Protocol content, you'll need to connect your NEAR wallet first.
                </p>
                <button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-full transition-colors disabled:opacity-50"
                >
                    {isConnecting ? 'Connecting...' : 'Connect NEAR Wallet'}
                </button>
            </div>
        );
    }

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

export default function ChatComponent() {
    return <AgentChat />;
} 