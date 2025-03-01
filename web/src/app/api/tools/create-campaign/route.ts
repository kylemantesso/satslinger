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
  console.log('🔄 Creating campaign transaction payload...');
  try {
    // Get parameters from URL search params
    const { searchParams } = new URL(request.url);
    const hashtags = searchParams.get('hashtags');
    const accountId = searchParams.get('accountId');
    const derivation = searchParams.get('derivation');

    // Validate required fields: hashtags and accountId are required.
    if (!hashtags || !accountId) {
      console.error('❌ Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: hashtags and accountId are required' },
        { status: 400 }
      );
    }

    // Use the provided derivation or default to "bitcoin-1"
    const derivationPath = derivation || 'bitcoin-1';
    console.log(`🔑 Deriving Bitcoin address for ${accountId} using derivation path ${derivationPath}...`);

    // Derive the Bitcoin address off-chain using the SignetBTC helper.
    const { address: btcAddress } = await Bitcoin.deriveAddressAndPublicKey(accountId, derivationPath);
    console.log('🔑 Derived BTC address:', btcAddress);

    // Create the transaction payload for campaign registration.
    // No deposit is needed, so deposit is set to "0".
    const transaction = {
      receiverId: nearConfig.contractName,
      actions: [
        {
          type: 'FunctionCall',
          params: {
            methodName: 'register_campaign',
            args: {
              hashtags: hashtags.split(','),
              btc_address: btcAddress,
            },
            gas: '300000000000000',
            deposit: '0',
          },
        },
      ],
    };

    console.log('✅ Transaction payload created successfully');
    return NextResponse.json({
      success: true,
      transaction,
      metadata: {
        hashtags: hashtags.split(','),
        btcAddress,
        owner: accountId,
        derivationPath,
      },
    });
  } catch (error) {
    console.error('❌ Error creating transaction payload:', error);
    return NextResponse.json({ error: (error as unknown as Error).toString() }, { status: 500 });
  }
}
