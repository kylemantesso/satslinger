import test from 'ava';
import * as dotenv from 'dotenv';
import fs from 'fs';
import { generateAddress } from './kdf.js';
import { contractCall } from './near-provider.js';
import { getBalance, getChange } from './bitcoin.js';
dotenv.config();

const {
    SATSLINGER_ACCOUNT_ID: accountId,
    LINKDROP_CONTRACT_ID: contractId,
    MPC_PUBLIC_KEY,
    MPC_PATH
} = process.env;

// Fixed testnet funding public key (uncompressed)
// const FUNDING_PUBKEY = '04d0f396ae4b64723c141f414b807dc12340502fff15320a84ec7eae3f5c996cefa6186b90cfbfe77d8c76a167ead7a917a48aa3d1c5771d649c0d3d0a90da39ba';
// const FUNDING_ADDRESS = 'mxbTAxP3RKhyokeQgXWhU7xHnTyxgZ1784'
// Create campaign
test('create campaign', async (t) => {
    // Get address details from KDF
    const { address, publicKey } = await generateAddress({
        publicKey: MPC_PUBLIC_KEY,
        accountId: contractId,
        path: MPC_PATH,
        chain: 'bitcoin'
    });

    console.log('\nFunding Details:');
    console.log('Address:', address);
    console.log('Public Key:', publicKey);
    console.log('\nIMPORTANT: Send BTC to this address:', address);

    // Get balance and UTXO info
    const balance = await getBalance({ address });
    console.log('Current Balance:', balance);

    const utxos = await getBalance({ address, getUtxos: true });
    if (utxos && utxos.length > 0) {
        console.log('Latest UTXO:', utxos[0]);
    }

    // Create the campaign
    const res = await contractCall({
        contractId,
        methodName: 'create_campaign',
        args: {
            funding_address: publicKey, // Use the derived public key
            path: MPC_PATH,
            search_terms: ['#NEAR', '@BitteProtocol', '@near_ai', '@NEARProtocol'],
            instruction: '',
            twitter_handle: '@SatSlinger',
        },
    });
    
    console.log('Campaign ID:', res);
    
    // Save details to file for reference
    const details = {
        address,
        publicKey,
        balance,
        utxos: utxos || [],
        campaignId: res
    };
    
    const detailsFile = 'campaign-details.json';
    fs.writeFileSync(detailsFile, JSON.stringify(details, null, 2));
    console.log(`\nDetails saved to ${detailsFile}`);
    
    t.true(!!res);
});
