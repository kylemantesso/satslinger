import * as nearAPI from 'near-api-js';
import * as dotenv from 'dotenv';
dotenv.config();

const { connect, keyStores, KeyPair } = nearAPI;

// Load environment variables
const {
    NEAR_ACCOUNT_ID: accountId,  // kylemantesso.testnet
    NEAR_PRIVATE_KEY,            // Original key we want to use
} = process.env;

async function recreateAccount() {
    try {
        // Create the key pair we want to use
        console.log('\nGenerating account details...');
        const newAccountKeyPair = KeyPair.fromString(NEAR_PRIVATE_KEY);
        const publicKey = newAccountKeyPair.getPublicKey().toString();
        
        // Create account using testnet helper API
        console.log('\nCreating account via NEAR testnet helper...');
        const response = await fetch('https://helper.testnet.near.org/account', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                newAccountId: accountId,
                newAccountPublicKey: publicKey,
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Successfully recreated account:', result);
        console.log('Account ID:', accountId);
        console.log('Public key:', publicKey);
        
    } catch (error) {
        console.error('Failed to recreate account:', error);
    }
}

// Run the script
recreateAccount().catch(console.error);