import test from 'ava';
import fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();
const {
    NEAR_ACCOUNT_ID: accountId,
    LINKDROP_CONTRACT_ID: contractId,
    MPC_PUBLIC_KEY,
    MPC_PATH,
} = process.env;
import { generateAddress } from './kdf.js';
import { contractView, contractCall, getAccount } from './near-provider.js';
import { generateSeedPhrase } from 'near-seed-phrase';
import * as nearAPI from 'near-api-js';
const { KeyPair } = nearAPI;

function btcToSatoshis(btc) {
    return Math.floor(parseFloat(btc) * 100000000).toString();
}


// List of methods that should exist in the contract
const REQUIRED_METHODS = [
    'create_campaign',
    'add_drop',
    'get_campaign',
    'get_campaign_drops',
    'get_drop',
    'claim'
];

// Create a key pair for the drop
const { secretKey: dropSecret } = generateSeedPhrase();
const dropKeyPair = KeyPair.fromString(dropSecret);

// Test variables
let funderAddress = null;
let campaignId = null;

// Verify contract is deployed and initialized
test('verify contract deployment', async (t) => {
    try {
        // Check if contract account exists
        const account = getAccount(contractId);
        const state = await account.state();
        console.log('\nContract state:', state);
        
        // Check if contract has code
        t.true(state.code_hash !== '11111111111111111111111111111111');
        
        // Check each required method exists
        for (const method of REQUIRED_METHODS) {
            try {
                await contractView({
                    contractId,
                    methodName: method,
                    args: method.startsWith('get_') ? { campaign_id: 0 } : {},
                });
            } catch (e) {
                // We expect certain errors, but not MethodNotFound
                if (e.message.includes('MethodNotFound')) {
                    t.fail(`Required method ${method} not found in contract`);
                }
                if (e.type === 'MethodNotFound') {
                    t.fail(`Required method ${method} not found in contract`);
                }
            }
        }
        
        console.log('\nAll required methods exist in contract');
        t.pass();
    } catch (e) {
        if (e.message.includes('does not exist')) {
            t.fail('Contract account does not exist');
        } else if (e.message.includes('no code')) {
            t.fail('Contract has no code deployed');
        } else if (e.type === 'AccountDoesNotExist') {
            t.fail('Contract account does not exist');
        } else {
            console.log('Unexpected error:', e);
            t.fail('Unexpected error checking contract');
        }
    }
});

// Generate funding address for campaign
test(`generate funding address`, async (t) => {
    const { address, publicKey } = await generateAddress({
        publicKey: MPC_PUBLIC_KEY,
        accountId: contractId,
        path: MPC_PATH,
        chain: 'bitcoin',
    });
    console.log('\nFunding address:', address);
    funderAddress = address;
    t.true(!!funderAddress);
});

// Create campaign
test('create campaign', async (t) => {
    const res = await contractCall({
        contractId,
        methodName: 'create_campaign',
        args: {
            funding_address: funderAddress,
            search_terms: ['test', 'test2'],
            instruction: 'Follow and retweet to receive sats!',
            twitter_handle: 'example_user',
        },
    });
    console.log('Campaign ID:', res);
    campaignId = res;
    t.true(!!res);
});

// Verify campaign was created
test('get campaign', async (t) => {
    const campaign = await contractView({
        contractId,
        methodName: 'get_campaign',
        args: { campaign_id: parseInt(campaignId) },
    });
    t.is(campaign.funding_address, funderAddress);
    t.is(campaign.twitter_handle, 'example_user');
    t.deepEqual(campaign.search_terms, ['test', 'test2']);
    t.is(campaign.instruction, 'Follow and retweet to receive sats!');
});

// Create drop
test('add drop', async (t) => {
    await contractCall({
        accountId,
        contractId,
        methodName: 'add_drop',
        args: {
            campaign_id: parseInt(campaignId),
            amount: btcToSatoshis("0.000546"), // Convert to satoshis (54600)
            target_twitter_handle: "example_user",
            key: dropKeyPair.getPublicKey().toString(),
        },
    });
    t.pass();
});

// Verify drop was created
test('get campaign drops', async (t) => {
    const drops = await contractView({
        contractId,
        methodName: 'get_campaign_drops',
        args: { 
            campaign_id: parseInt(campaignId),
        },
    });
    console.log('Campaign drops:', drops);
    t.true(drops.length > 0);
});

// Verify drop details
test('get drop', async (t) => {
    const drops = await contractView({
        contractId,
        methodName: 'get_campaign_drops',
        args: { 
            campaign_id: parseInt(campaignId),
        },
    });
    
    // Get the first drop ID
    const dropId = drops[0];
    
    const drop = await contractView({
        contractId,
        methodName: 'get_drop',
        args: { 
            drop_id: dropId,
        },
    });
    
    console.log('Drop details:', drop);
    t.is(drop.campaign_id, parseInt(campaignId));
    t.is(drop.target_twitter_handle, "example_user");
});

// Save drop link for later use
test('save drop link', async (t) => {
    const path = `keys-${Date.now()}.txt`;
    fs.writeFileSync(
        path,
        Buffer.from(
            `http://localhost:1234/?contractId=${contractId}&secretKey=${dropSecret}&from=Matt`,
        ),
    );
    console.log('\nDrop link saved to:', path);
    t.pass();
});
