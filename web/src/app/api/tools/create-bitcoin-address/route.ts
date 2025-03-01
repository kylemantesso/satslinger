import { NextResponse } from "next/server";
import { CONTRACT_ID } from '@/utils/near';
import { generateAddress } from '@/utils/kdf';

export async function GET(request: Request) {
    
    try {
        // Generate unique path using timestamp
        const mpcPath = `bitcoin-drop,${Date.now()}`;
        console.log('Generating address with path:', mpcPath);

        const { address, publicKey } = await generateAddress({
            publicKey: process.env.MPC_PUBLIC_KEY!,
            accountId: CONTRACT_ID,
            path: mpcPath,
            chain: 'bitcoin'
        });

        return NextResponse.json({
            address,
            publicKey,
            mpcPath
        });

    } catch (error) {
        console.error('Error creating Bitcoin address:', error);
        return NextResponse.json(
            { error: 'Failed to create Bitcoin address' },
            { status: 500 }
        );
    }
} 