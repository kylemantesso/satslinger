import { NextResponse } from "next/server";
import { CONTRACT_ID } from '@/utils/near';
import { generateAddress } from '@/utils/kdf';

export async function GET(request: Request) {
    
    try {
        // Generate unique path using timestamp
        const mpcPath = `bitcoin-drop,${Date.now()}`;
        console.log('Generating address with path:', mpcPath);
        
        // Log the MPC public key
        console.log('MPC_PUBLIC_KEY from env:', process.env.MPC_PUBLIC_KEY);
        
        if (!process.env.MPC_PUBLIC_KEY) {
            throw new Error('MPC_PUBLIC_KEY environment variable is not set');
        }

        const { address, publicKey } = await generateAddress({
            publicKey: process.env.MPC_PUBLIC_KEY,
            accountId: CONTRACT_ID,
            path: mpcPath,
            chain: 'bitcoin'
        });

        console.log('Generated Bitcoin address:', address);
        console.log('Generated public key:', publicKey);

        return NextResponse.json({
            address,
            publicKey,
            mpcPath
        });

    } catch (error: any) {
        console.error('Error creating Bitcoin address:', error);
        return NextResponse.json(
            { error: `Failed to create Bitcoin address: ${error.message}` },
            { status: 500 }
        );
    }
} 