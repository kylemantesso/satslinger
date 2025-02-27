import { NextResponse } from 'next/server';
import { connect, keyStores, KeyPair } from 'near-api-js';
import { FinalExecutionOutcome } from 'near-api-js/lib/providers';

const CONTRACT_ID = 'satslinger.coldice4974.testnet';
const NEAR_ACCOUNT_ID = process.env.SATSLINGER_ACCOUNT_ID!;
const NEAR_PRIVATE_KEY = process.env.SATSLINGER_PRIVATE!;

// Initialize NEAR connection
const keyStore = new keyStores.InMemoryKeyStore();
const config = {
  networkId: 'testnet',
  keyStore,
  nodeUrl: 'https://rpc.testnet.near.org',
  headers: {},
  // Increase timeouts significantly
  networkTimeout: 60000,          // 60 seconds general timeout
  transactionPollingTimeout: 60000, // 60 seconds for transaction completion
  // Add additional timeout configs
  maxLedgerTransactionTimeout: 60000,
  walletTimeout: 60000,
  explorerTimeout: 60000,
  jsvmAccountsStorageKey: 60000
};

async function initKeyStore() {
  if (!NEAR_PRIVATE_KEY || !NEAR_ACCOUNT_ID) {
    throw new Error('Missing NEAR credentials');
  }
  
  const keyPair = KeyPair.fromString(NEAR_PRIVATE_KEY as any);
  await keyStore.setKey('testnet', NEAR_ACCOUNT_ID, keyPair);
  
  return connect(config);
}

export async function POST(request: Request) {
  try {
    const { hash, btcAddress, twitterProof, txid, vout, change } = await request.json();

    // Validate required fields
    if (!hash || !btcAddress || !twitterProof || !txid || vout === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('Received claim request:', {
      hash, btcAddress, twitterProof, txid, vout, change
    });

    // Initialize NEAR connection
    const near = await initKeyStore();
    const account = await near.account(NEAR_ACCOUNT_ID);

    // Format args exactly as contract expects
    const args = {
      hash,
      txid_str: txid,
      vout: Number(vout),
      receiver: btcAddress,
      change: change?.toString() || '0',
      twitter_proof: twitterProof
    };

    console.log('Sending args to contract:', args);

    // Validate args before sending
    if (isNaN(args.vout)) {
      throw new Error('Invalid vout value');
    }

    // Call the claim method on the contract
    console.log('Calling contract claim method...');
    const result = await account.functionCall({
      contractId: CONTRACT_ID,
      methodName: 'claim',
      args,
      gas: BigInt(300_000_000_000_000),
      attachedDeposit: BigInt(0)
    });

    // Poll for transaction result
    const txHash = result.transaction.hash;
    console.log('Transaction hash:', txHash);

    let attempts = 0;
    const maxAttempts = 10;
    while (attempts < maxAttempts) {
      try {
        const status = await near.connection.provider.txStatus(
          txHash, 
          NEAR_ACCOUNT_ID
        );
        if (status.status.SuccessValue) {
          const signedBitcoinTx = status.status.SuccessValue;
          console.log('Got signed transaction:', signedBitcoinTx);
          
          // Decode and return
          const decodedTx = Buffer.from(signedBitcoinTx, 'base64').toString();
          return NextResponse.json({ 
            success: true,
            signedTx: decodedTx 
          });
        }
      } catch (e) {
        console.log('Polling attempt failed:', e);
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between attempts
    }

    throw new Error('Transaction timed out after polling');

  } catch (error) {
    console.error('Error claiming drop:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to claim drop' },
      { status: 500 }
    );
  }
} 