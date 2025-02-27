import * as bitcoin from 'bitcoinjs-lib';
import { networks, payments, crypto } from 'bitcoinjs-lib';

export function convertLegacyToSegwit(legacyAddress: string): string {
  try {
    // Decode the legacy testnet address
    const { version, hash } = bitcoin.address.fromBase58Check(legacyAddress);
    
    // For testnet addresses:
    // version 111 (0x6F) is testnet P2PKH (addresses starting with 'm' or 'n')
    if (version !== 111) {
      console.warn('Not a testnet P2PKH address');
      return legacyAddress;
    }

    // Create a native segwit testnet address (P2WPKH)
    return bitcoin.address.toBech32(
      hash,
      0,  // witness version
      'tb'  // testnet bech32 prefix
    );
  } catch (error) {
    console.error('Error converting address:', error);
    return legacyAddress;
  }
}

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
    const networkId = 'testnet';
    const bitcoinRpc = `https://blockstream.info/${
      networkId === 'testnet' ? 'testnet/' : ''
    }/api`;
    
    console.log('Broadcasting transaction:', rawTx);
    
    // Don't try to modify the transaction - send it as is
    let txToSend = rawTx;
    
    // Try broadcasting with multiple APIs for better chances of success
    let response;
    try {
      // Try mempool.space first
      response = await fetch(`https://corsproxy.io/?url=https://mempool.space/testnet/api/tx`, {
        method: 'POST',
        body: txToSend,
      });
      
      if (response.status !== 200) {
        throw new Error("First broadcast attempt failed, trying another endpoint");
      }
    } catch (e) {
      console.log('First broadcast attempt failed, trying alternative endpoint...');
      // Try blockstream as a fallback
      response = await fetch(`https://corsproxy.io/?url=${bitcoinRpc}/tx`, {
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