import { NextResponse } from "next/server";
import { connect, keyStores } from "near-api-js";

// NEAR connection setup
const getConnection = async () => {
    const keyStore = new keyStores.InMemoryKeyStore();
    const config = {
        networkId: process.env.NEXT_PUBLIC_NEAR_NETWORK_ID || 'testnet',
        keyStore,
        nodeUrl: `https://rpc.${process.env.NEXT_PUBLIC_NEAR_NETWORK_ID || 'testnet'}.near.org`,
    };
    return await connect(config);
};

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const hash = searchParams.get('hash');

    if (!hash) {
        return NextResponse.json(
            { error: "Hash parameter is required" },
            { status: 400 }
        );
    }

    try {
        const near = await getConnection();
        const account = await near.account(process.env.SATSLINGER_ACCOUNT_ID!);
        const contract = process.env.NEXT_PUBLIC_LINKDROP_CONTRACT_ID!;

        const dropData = await account.viewFunction({
            contractId: contract,
            methodName: 'get_drop',
            args: { hash }
        });

        if (!dropData) {
            return NextResponse.json(
                { error: "Drop not found" },
                { status: 404 }
            );
        }

        // Transform contract data to match the API spec
        const response = {
            id: hash,
            amount: dropData.amount,
            target_twitter_handle: dropData.target_twitter_handle,
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('Failed to fetch drop:', error);
        return NextResponse.json(
            { error: "Failed to fetch drop information" },
            { status: 500 }
        );
    }
} 