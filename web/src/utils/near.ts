import { connect, keyStores, WalletConnection } from 'near-api-js';

const config = {
  networkId: 'testnet',
  nodeUrl: 'https://rpc.testnet.near.org',
  walletUrl: 'https://wallet.testnet.near.org',
  helperUrl: 'https://helper.testnet.near.org',
  explorerUrl: 'https://explorer.testnet.near.org',
};

export const CONTRACT_ID = 'satslinger.coldice4974.testnet';

// Initialize contract
export async function initNear() {
  const near = await connect({
    ...config,
    keyStore: new keyStores.BrowserLocalStorageKeyStore(),
  });
  
  const wallet = new WalletConnection(near, 'satslinger');
  return { near, wallet };
} 