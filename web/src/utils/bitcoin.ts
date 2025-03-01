import { networks, payments } from 'bitcoinjs-lib';
import { NETWORK_ID } from './near';

export function pubKeyToAddress(pubKeyHex: string): string {
  // Convert hex string to Buffer
  const pubKeyBuffer = Buffer.from(pubKeyHex, 'hex');
  
  // Create payment object
  const payment = payments.p2pkh({
    pubkey: pubKeyBuffer,
    network: networks.testnet
  });

  // Return the address
  return payment.address!;
}

/**
 * Broadcasts a Bitcoin transaction with proper DER signature handling
 */
export const broadcastTransaction = async (rawTx: string): Promise<string> => {
  try {
    const isTestnet = NETWORK_ID === 'testnet';
    const blockstreamRpc = `https://blockstream.info/${
      isTestnet ? 'testnet/' : ''
    }/api`;
    
    console.log('Broadcasting transaction:', rawTx);
    
    // Don't try to modify the transaction - send it as is
    let txToSend = rawTx;
    
    // Try broadcasting with multiple APIs for better chances of success
    let response;
    try {
      // Try mempool.space first with proper network
      const mempoolUrl = `https://corsproxy.io/?url=https://mempool.space/${
        isTestnet ? 'testnet/' : ''
      }api/tx`;
      
      response = await fetch(mempoolUrl, {
        method: 'POST',
        body: txToSend,
      });
      
      if (response.status !== 200) {
        throw new Error("First broadcast attempt failed, trying another endpoint");
      }
    } catch (e) {
      console.log('First broadcast attempt failed, trying alternative endpoint...');
      // Try blockstream as a fallback
      response = await fetch(`https://corsproxy.io/?url=${blockstreamRpc}/tx`, {
        method: 'POST',
        body: txToSend,
      });
    }
    
    if (response.status === 200) {
      const hash = await response.text();
      console.log('Transaction hash:', hash);
      return hash;
    }
    
    const errorText = await response.text();
    console.log('Error response:', errorText);
    throw new Error(`Failed to broadcast: ${errorText}`);
  } catch (e) {
    console.log('Error broadcasting bitcoin tx:', e);
    throw e;
  }
}; 