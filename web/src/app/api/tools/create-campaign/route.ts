import { NextResponse } from 'next/server';
import { Bitcoin as SignetBTC, BTCRpcAdapters } from 'signet.js';

import { utils } from "signet.js";
import { KeyPair } from "@near-js/crypto";
import { CONTRACT_ID, NETWORK_ID, RPC_URL } from '@/utils/near';


const MPC_CONTRACT = NETWORK_ID === 'mainnet' ? 'v1.signer-prod.near' : 'v1.signer-prod.testnet'
// const MPC_KEY = 'secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3';

const CONTRACT = new utils.chains.near.contract.NearChainSignatureContract({
  networkId: NETWORK_ID as any,
  contractId: MPC_CONTRACT,
  accountId: '',
  keypair: KeyPair.fromRandom("ed25519"),
})

const nearConfig = {
  networkId: NETWORK_ID,
  nodeUrl: RPC_URL,
  contractName: CONTRACT_ID,
};

// Initialize the BTCRpcAdapter and SignetBTC instance
const btcRpcAdapter = new BTCRpcAdapters.Mempool(
  NETWORK_ID === 'mainnet' 
    ? 'https://mempool.space/api' 
    : 'https://mempool.space/testnet/api'
);
const Bitcoin = new SignetBTC({
  network: NETWORK_ID as any,
  contract: CONTRACT,
  btcRpcAdapter,
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const searchTerms = searchParams.get('searchTerms')?.split(',') || [];
    const twitterHandle = searchParams.get('twitterHandle');
    const fundingPublicKey = searchParams.get('fundingPublicKey');
    const mpcPath = searchParams.get('mpcPath');

    if (!searchTerms.length || !twitterHandle || !fundingPublicKey || !mpcPath) {
      return NextResponse.json(
        { error: 'searchTerms, twitterHandle, fundingAddress, and mpcPath are required' },
        { status: 400 }
      );
    }

    // Create transaction payload
    const transactionPayload = {
      contractId: CONTRACT_ID,
      methodName: 'create_campaign',
      args: {
        funding_address: fundingPublicKey,
        path: mpcPath,
        search_terms: searchTerms,
        instruction: '',
        twitter_handle: twitterHandle,
      },
      gas: '300000000000000', // 300 TGas
      deposit: '0'  // Explicitly set deposit to 0
    };

    return NextResponse.json({ transactionPayload });

  } catch (error) {
    console.error('Error preparing campaign creation:', error);
    return NextResponse.json(
      { error: 'Failed to prepare campaign creation' },
      { status: 500 }
    );
  }
}
