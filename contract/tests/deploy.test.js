import test from 'ava';
import fs from 'fs';
import * as EC from 'elliptic';
const ec = EC.default ? new EC.default.ec('secp256k1') : new EC.ec('secp256k1');
import * as dotenv from 'dotenv';
dotenv.config();
const {
    NEAR_ACCOUNT_ID: accountId,
    NEAR_PRIVATE_KEY,
    SATSLINGER_PUBLIC,
    SATSLINGER_PRIVATE,
    LINKDROP_CONTRACT_ID: contractId,
    AUTH_PUBLIC_KEY,
    REACT_APP_MPC_PUBLIC_KEY: MPC_PUBLIC_KEY,
    REACT_APP_MPC_PATH: MPC_PATH,
} = process.env;
import { generateAddress } from './kdf.js';
import {
    getAccount,
    contractView,
    contractCall,
    keyPair,
    keyStore,
    networkId,
} from './near-provider.js';
import { broadcast, getBalance, getChange } from './bitcoin.js';

import * as nearAPI from 'near-api-js';
const { KeyPair } = nearAPI;
const dropKeyPair = KeyPair.fromString(
    'ed25519:4Da461pSxbSX8pc8L2SiQMwgHJJBYEovMVp7XgZRZLVbf1sk8pu139ie89MftYEQBJtN5dLc349FPXgUyBBE1mp1',
);

const DROP_SATS = 546;
// based on MPC_PATH, will be set by tests
let funderPublicKey = null;
let funderAddress = null;
let funderBalance = null;
let funderTxId = null;
let dropChange = null;

// Constants
const INIT_GAS = '300000000000000'; // 300 TGas

// Verify required environment variables
test('check environment', (t) => {
    console.log('Using account:', accountId);
    console.log('Deploying to:', contractId);
    console.log('Auth public key:', AUTH_PUBLIC_KEY || '(using default)');
    
    t.true(!!accountId, 'NEAR_ACCOUNT_ID is required');
    t.true(!!contractId, 'LINKDROP_CONTRACT_ID is required');
    t.pass();
});

test('delete, create contract account', async (t) => {
    try {
        // Use the satslinger key pair
        const contractKeyPair = KeyPair.fromString(SATSLINGER_PRIVATE);
        
        // Create the new contract account
        const account = getAccount(accountId);
        await account.createAccount(
            'satslinger.testnet',
            contractKeyPair.getPublicKey(),
            nearAPI.utils.format.parseNearAmount('10')
        );

        // Add the key pair to the key store
        await keyStore.setKey(networkId, 'satslinger.testnet', contractKeyPair);
        
        console.log('Created contract account and stored keys');
    } catch (e) {
        if (!e.toString().includes('already exists')) {
            throw e;
        }
        console.log('Account already exists, adding keys to keyStore...');
        
        // If account exists, ensure we have the keys
        const contractKeyPair = KeyPair.fromString(SATSLINGER_PRIVATE);
        await keyStore.setKey(networkId, 'satslinger.testnet', contractKeyPair);
    }
    t.pass();
});

test('deploy contract', async (t) => {
    const contractAccount = getAccount(contractId);
    const ownerAccount = getAccount(accountId);
    
    // Add owner's key to keystore
    const ownerKeyPair = KeyPair.fromString(NEAR_PRIVATE_KEY);
    await keyStore.setKey(networkId, accountId, ownerKeyPair);
    
    // Clear state before deploying
    try {
        await ownerAccount.functionCall({
            contractId,
            methodName: 'clear_state',
            args: {},
            gas: INIT_GAS
        });
        console.log('Cleared contract state');
    } catch (e) {
        console.log('Clear state error:', e);
        console.log('Could not clear state (this is normal for first deploy)');
    }

    // Deploy the contract
    const file = fs.readFileSync('./contract/target/near/contract.wasm');
    await contractAccount.deployContract(file);
    console.log('deployed bytes', file.byteLength);
    const balance = await contractAccount.getAccountBalance();
    console.log('contract balance', balance);

    t.pass();
});

test('init contract', async (t) => {
    const account = getAccount(contractId);
    
    try {
        // You could add a view method to check if contract is initialized
        // Or just catch the error and continue
        const args = {
            owner_id: accountId,
            auth_public_key: AUTH_PUBLIC_KEY || "0000000000000000000000000000000000000000000000000000000000000000",
        };
        
        console.log('Initializing contract with:', args);
        
        await account.functionCall({
            contractId,
            methodName: 'init',
            args,
            gas: INIT_GAS,
        });
        console.log('Contract initialized successfully');
    } catch (e) {
        // If contract is already initialized, that's okay
        if (e.toString().includes("already been initialized")) {
            console.log('Contract was already initialized');
            t.pass();
            return;
        }
        throw e;
    }
    t.pass();
});
