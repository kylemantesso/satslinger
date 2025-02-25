import test from 'ava';
import * as dotenv from 'dotenv';
dotenv.config();
const {
    NEAR_ACCOUNT_ID: accountId,
    LINKDROP_CONTRACT_ID: contractId,
} = process.env;
import { contractCall } from './near-provider.js';
import { generateSeedPhrase } from 'near-seed-phrase';
import * as nearAPI from 'near-api-js';
const { KeyPair } = nearAPI;

function btcToSatoshis(btc) {
    return Math.floor(parseFloat(btc) * 100000000).toString();
}

// Create a key pair for the drop
const { secretKey: dropSecret } = generateSeedPhrase();
const dropKeyPair = KeyPair.fromString(dropSecret);

const CAMPAIGN_ID = 15;

// Add drop
test('add drop', async (t) => {
    await contractCall({
        accountId,
        contractId,
        methodName: 'add_drop',
        args: {
            campaign_id: parseInt(CAMPAIGN_ID),
            amount: btcToSatoshis("0.000546"), // Convert to satoshis (54600)
            target_twitter_handle: "example_user",
            key: dropKeyPair.getPublicKey().toString(),
        },
    });
    t.pass();
});

