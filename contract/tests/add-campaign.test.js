import test from 'ava';
import * as dotenv from 'dotenv';
dotenv.config();
const {
    NEAR_ACCOUNT_ID: accountId,
    LINKDROP_CONTRACT_ID: contractId,
    MPC_PUBLIC_KEY,
    MPC_PATH,
} = process.env;
import { generateAddress } from './kdf.js';
import { contractCall } from './near-provider.js';
import * as nearAPI from 'near-api-js';
import crypto from 'crypto';



// Create campaign
test('create campaign', async (t) => {
    const { address, publicKey } = await generateAddress({
        publicKey: MPC_PUBLIC_KEY,
        accountId: contractId,
        path: MPC_PATH,
        chain: 'bitcoin',
    });
    console.log('\nFunding address:', address);

    const res = await contractCall({
        contractId,
        methodName: 'create_campaign',
        args: {
            funding_address: address,
            search_terms: ['#NEAR', '@BitteProtocol', '@near_ai', '@NEARProtocol'],
            instruction: '',
            twitter_handle: '@satslinger',
        },
    });
    console.log('Campaign ID:', res);
    t.true(!!res);
});
