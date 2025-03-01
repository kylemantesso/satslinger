import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { connect, keyStores, utils } from "near-api-js";

const { BITTE_API_KEY, BITTE_API_URL = "https://wallet.bitte.ai/api/v1/chat" } =
  process.env;

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

export const GET = async (req: NextRequest): Promise<Response> => {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const hash = searchParams.get('hash');

    try {
        const near = await getConnection();
        const account = await near.account(process.env.SATSLINGER_ACCOUNT_ID!);
        const contract = process.env.NEXT_PUBLIC_LINKDROP_CONTRACT_ID!;

        switch (action) {
            case 'unclaimed-drops':
                const unclaimedDrops = await account.viewFunction({
                    contractId: contract,
                    methodName: 'get_unclaimed_drops',
                    args: {}
                });
                return NextResponse.json({ drops: unclaimedDrops });

            case 'claimed-drops':
                const claimedDrops = await account.viewFunction({
                    contractId: contract,
                    methodName: 'get_claimed_drops',
                    args: {}
                });
                return NextResponse.json({ drops: claimedDrops });

            case 'drop':
                if (!hash) {
                    return NextResponse.json({ error: 'Hash parameter is required' }, { status: 400 });
                }
                const drop = await account.viewFunction({
                    contractId: contract,
                    methodName: 'get_drop',
                    args: { hash }
                });
                return NextResponse.json({ drop });

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        console.error('Failed to fetch drops:', error);
        return NextResponse.json({ error: 'Failed to fetch drops' }, { status: 500 });
    }
};

export const POST = async (req: NextRequest): Promise<Response> => {
  const requestInit: RequestInit & { duplex: "half" } = {
    method: "POST",
    body: req.body,
    headers: {
      Authorization: `Bearer ${BITTE_API_KEY}`,
    },
    duplex: "half",
  };

  const upstreamResponse = await fetch(BITTE_API_URL, requestInit);
  const headers = new Headers(upstreamResponse.headers);
  headers.delete("Content-Encoding");

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers,
  });
};