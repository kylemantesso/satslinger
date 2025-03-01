import { connect, keyStores, WalletConnection } from 'near-api-js';

const getConfig = () => {
  const networkId = process.env.NEXT_PUBLIC_NEAR_NETWORK_ID || 'testnet';
  
  if (networkId === 'mainnet') {
    return {
      networkId: 'mainnet',
      nodeUrl: 'https://rpc.mainnet.near.org',
      walletUrl: 'https://wallet.near.org',
      helperUrl: 'https://helper.mainnet.near.org',
      explorerUrl: 'https://explorer.near.org',
    };
  }
  
  return {
    networkId: 'testnet',
    nodeUrl: 'https://rpc.testnet.near.org',
    walletUrl: 'https://wallet.testnet.near.org',
    helperUrl: 'https://helper.testnet.near.org',
    explorerUrl: 'https://explorer.testnet.near.org',
  };
};

export const RPC_URL = getConfig().nodeUrl;

export const NETWORK_ID = getConfig().networkId;

export const config = getConfig();

export const CONTRACT_ID = process.env.NEXT_PUBLIC_LINKDROP_CONTRACT_ID!;

// Initialize contract
export async function initNear() {
  const near = await connect({
    ...config,
    keyStore: new keyStores.BrowserLocalStorageKeyStore(),
  });
  
  const wallet = new WalletConnection(near, 'satslinger');
  return { near, wallet };
} 