import test from 'ava';
import fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();

const {
    SATSLINGER_ACCOUNT_ID: accountId,
    LINKDROP_CONTRACT_ID: contractId,
    AUTH_PUBLIC_KEY: authPublicKey,
} = process.env;

import {
    getAccount,
    contractCall,
    keyPair,
} from './near-provider.js';

import * as nearAPI from 'near-api-js';

test('delete, create contract account', async (t) => {
    try {
        const account = getAccount(contractId);
        await account.deleteAccount(accountId);
    } catch (e) {
        console.log('error deleteAccount', e);
    }

    try {
        const account = getAccount(accountId);
        await account.createAccount(
            contractId,
            keyPair.getPublicKey(),
            '10000000000000000000000000' // 10 NEAR for mainnet
        );
    } catch (e) {
        console.log('error createAccount', e);
    }
    t.pass();
});

test('deploy contract', async (t) => {
    const file = fs.readFileSync('./contract/target/near/contract.wasm');
    const account = getAccount(contractId);
    await account.deployContract(file);
    console.log('deployed bytes', file.byteLength);
    const balance = await account.getAccountBalance();
    console.log('contract balance', balance);
    t.pass();
});

test('init contract', async (t) => {
    await contractCall({
        contractId,
        methodName: 'init',
        args: {
            owner_id: accountId,
            auth_public_key: authPublicKey
        },
    });
    t.pass();
});