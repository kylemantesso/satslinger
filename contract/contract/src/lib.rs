use hex::{decode, encode};
use near_sdk::{
    env::{self},
    json_types::U128,
    log, near, require,
    store::{IterableMap, LookupMap},
    AccountId, Allowance, Gas, NearToken, PanicOnDefault, Promise, PromiseError, PublicKey,
    serde_json, bs58,
};
use serde::{Serialize, Deserialize};
use omni_transaction::bitcoin::bitcoin_transaction::BitcoinTransaction;
mod bitcoin_tx;
mod ecdsa;
mod external;
mod utils;

const MPC_CONTRACT_ACCOUNT_ID: &str = "v1.signer-prod.testnet";
const MPC_GAS: Gas = Gas::from_tgas(100);
const MPC_ATTACHED_DEPOSIT: NearToken = NearToken::from_yoctonear(500000000000000000000000);

const CALLBACK_GAS: Gas = Gas::from_tgas(100);

pub const ACCESS_KEY_METHODS: &str = "claim";
pub const ACCESS_KEY_ALLOWANCE: NearToken = NearToken::from_near(2);

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Campaign {
    creator: AccountId,
    path: String,
    funding_address: String,
    created_at: u64,
    search_terms: Vec<String>,
    twitter_handle: String,
}

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Drop {
    campaign_id: u128,
    amount: u128,
    funder: String,
    path: String,
    keys: Vec<String>,
    op_return_hex: Option<String>,
    target_twitter_handle: String,
    target_tweet_id: String,
    hash: String,
    claimed: bool,
    claimed_by: Option<String>,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct TwitterProof {
    pub handle: String,
    pub timestamp: u64,
    pub signature: String,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    pub owner_id: AccountId,
    pub campaign_id: u128,
    pub campaigns: IterableMap<u128, Campaign>,
    pub drops: IterableMap<String, Drop>,
    pub auth_public_key: String,
    pub drop_by_key: LookupMap<String, String>,
}

#[near]
impl Contract {
    #[init]
    #[private]
    pub fn init(owner_id: AccountId, auth_public_key: String) -> Self {
        Self {
            owner_id,
            campaign_id: 0,
            campaigns: IterableMap::new(b"a"),
            drops: IterableMap::new(b"b"),
            auth_public_key,
            drop_by_key: LookupMap::new(b"k"),
        }
    }

    /// Create a new campaign and get its funding address
    pub fn create_campaign(
        &mut self,
        funding_address: String,
        path: String,
        search_terms: Vec<String>,
        twitter_handle: String,
    ) -> String {
        let creator = env::predecessor_account_id();

        let campaign_id = self.campaign_id;
        self.campaign_id += 1;
        let campaign = Campaign {
            creator,
            path: path.clone(),
            funding_address,
            created_at: env::block_timestamp(),
            search_terms,
            twitter_handle,
        };
        self.campaigns.insert(campaign_id, campaign);
        campaign_id.to_string()
    }

    /// Admin function to create drops from a funded campaign and add a claim key
    pub fn add_drop(
        &mut self,
        campaign_id: u128,
        amount: U128,
        target_twitter_handle: String,
        target_tweet_id: String,
        hash: String,
    ) {
        require!(
            env::predecessor_account_id() == self.owner_id,
            "Only the contract owner can add drops"
        );

        let campaign = self.campaigns.get(&campaign_id)
            .expect("Campaign not found");

        // Generate unique path for this drop using hash
        

        let drop = Drop {
            campaign_id,
            amount: amount.0,
            funder: campaign.funding_address.clone(),
            path: campaign.path.clone(),
            keys: vec![],
            op_return_hex: None,
            target_twitter_handle,
            target_tweet_id,
            hash: hash.clone(),
            claimed: false,
            claimed_by: None,
        };

        self.drops.insert(hash, drop);
    }

    pub fn claim(
        &mut self,
        txid_str: String,
        vout: u32,
        receiver: String,
        change: U128,
    ) -> Promise {
        let key = String::from(&env::signer_account_pk());
        let drop_hash = self.drop_by_key.get(&key).expect("No drop found for this key");
        
        // Convert drop_hash to a regular String before looking it up
        let drop = self.drops.get(&drop_hash.to_string()).expect("Drop not found");
        
        // Use the path stored with the drop
        let path = drop.path.clone();
        
        // extract drop params
        let amount = drop.amount;
        let funder = &drop.funder;  // This is the uncompressed public key in hex

        log!("path {:?}", path);
        log!("vout {:?}", vout);
        log!("funder {:?}", funder);
        log!("receiver {:?}", receiver);
        log!("amount {:?}", amount);
        log!("change {:?}", change.0);
        log!("op_return_hex {:?}", drop.op_return_hex);

        // create bitcoin tx
        let tx = bitcoin_tx::get_tx(
            &txid_str,
            vout,
            &funder,
            &receiver,
            amount,
            change.0,
            drop.op_return_hex.to_owned(),
        );

        // prepare args for Chain Signatures call ecdsa::get_sig
        let encoded_tx = bitcoin_tx::get_encoded_tx(tx.clone());
        let payload = bitcoin_tx::sha256d(encoded_tx);
        let key_version = 0;

        // Use the public key directly instead of trying to decode it as an address
        ecdsa::get_sig(payload, path.to_owned(), key_version).then(
            external::this_contract::ext(env::current_account_id())
                .with_static_gas(CALLBACK_GAS)
                .callback(tx, decode(funder).unwrap()),
        )
    }

    // View methods
    pub fn get_campaign(&self, campaign_id: u128) -> Option<Campaign> {
        self.campaigns.get(&campaign_id).cloned()
    }

    pub fn get_campaign_drops(&self, campaign_id: u128) -> Vec<String> {
        self.drops
            .iter()
            .filter(|(_, drop)| drop.campaign_id == campaign_id)
            .map(|(hash, _)| hash.clone())
            .collect()
    }

    pub fn get_drop(&self, hash: String) -> Option<Drop> {
        self.drops.get(&hash).cloned()
    }

    /// Get the current auth public key
    pub fn get_auth_public_key(&self) -> String {
        self.auth_public_key.clone()
    }

    /// Set a new auth public key. Only callable by contract owner.
    pub fn set_auth_public_key(&mut self, new_key: String) {
        require!(
            env::predecessor_account_id() == self.owner_id,
            "Only the contract owner can update the auth public key"
        );
        require!(
            new_key.len() == 64, 
            "Public key must be 64 characters (32 bytes in hex)"
        );
        // Verify the key is valid hex
        hex::decode(&new_key)
            .expect("Invalid hex string for public key");
        self.auth_public_key = new_key;
    }

    // fn verify_twitter_proof(&self, proof_b58: &str) -> Option<TwitterProof> {
    //     // Decode base58 proof
    //     let proof_bytes = bs58::decode(proof_b58).into_vec().ok()?;
    //     let proof: TwitterProof = serde_json::from_slice(&proof_bytes).ok()?;
    //     // Verify signature using auth service's public key
    //     let auth_public_key = hex::decode(&self.auth_public_key).ok()?;
    //     // Convert to fixed size array
    //     let auth_key_array: [u8; 32] = auth_public_key.try_into().ok()?;
    //     let message = format!("{}:{}", proof.handle, proof.timestamp);
    //     // Convert signature to fixed size array
    //     let sig_bytes = hex::decode(&proof.signature).ok()?;
    //     let sig_array: [u8; 64] = sig_bytes.try_into().ok()?;
    //     // Use ed25519_verify from near_sdk::env
    //     if env::ed25519_verify(&sig_array, message.as_bytes(), &auth_key_array) {
    //         Some(proof)
    //     } else {
    //         None
    //     }
    // }

    pub fn add_drop_key(&mut self, hash: String, key: String) {
        require!(env::predecessor_account_id() == self.owner_id);

        // Check if key already exists
        if !self.drop_by_key.insert(key.clone(), hash.clone()).is_none() {
            return;
        }

        // Update drop with new key
        let mut drop = self.drops.get(&hash.to_string()).expect("Drop not found").clone();
        drop.keys.push(key.clone());
        self.drops.insert(hash.clone(), drop);

        // Set up access key
        let pk: PublicKey = key.parse().unwrap();
        Promise::new(env::current_account_id())
            .delete_key(pk.clone())
            .then(
                Promise::new(env::current_account_id()).add_access_key_allowance(
                    pk,
                    Allowance::limited(ACCESS_KEY_ALLOWANCE).unwrap(),
                    env::current_account_id(),
                    ACCESS_KEY_METHODS.to_string(),
                ),
            );
    }

    #[private]
    pub fn remove_key_callback(&mut self) {
        // let key = String::from(&env::signer_account_pk());
        // self.remove_key_internal(key);
    }

    fn remove_key_internal(&mut self, key: String) {
        let hash_option = self.drop_by_key.get(&key);
        if hash_option.is_none() {
            return;
        }

        let hash = hash_option.unwrap().clone();
        let mut drop = self.drops.get(&hash.to_string()).expect("Drop not found").clone();
        drop.keys.retain(|s| s != &key);
        self.drops.insert(hash, drop);

        self.drop_by_key.remove(&key);

        let pk: PublicKey = key.parse().unwrap();
        Promise::new(env::current_account_id()).delete_key(pk);
    }

    // Add view method for keys
    pub fn get_keys(&self, hash: String) -> Vec<String> {
        match self.drops.get(&hash) {
            Some(drop) => drop.keys.clone(),
            None => vec![],
        }
    }

    /// Allow campaign creator to update search terms
    pub fn update_search_terms(&mut self, campaign_id: u128, search_terms: Vec<String>) {
        let campaign = self.campaigns.get_mut(&campaign_id)
            .expect("Campaign not found");
        
        require!(
            env::predecessor_account_id() == campaign.creator,
            "Only campaign creator can update search terms"
        );

        campaign.search_terms = search_terms;
    }

    /// Get all campaigns
    pub fn get_campaigns(&self) -> Vec<(u128, Campaign)> {
        self.campaigns
            .iter()
            .map(|(id, campaign)| (*id, campaign.clone()))
            .collect()
    }

    /// Delete a campaign. Only callable by contract owner or campaign creator.
    pub fn delete_campaign(&mut self, campaign_id: u128) {
        let campaign = self.campaigns.get(&campaign_id)
            .expect("Campaign not found");
        
        let caller = env::predecessor_account_id();
        require!(
            caller == self.owner_id || caller == campaign.creator,
            "Only contract owner or campaign creator can delete campaign"
        );

        // Remove all associated drops
        let drop_hashes: Vec<String> = self.drops
            .iter()
            .filter(|(_, drop)| drop.campaign_id == campaign_id)
            .map(|(hash, _)| hash.clone())
            .collect();

        for hash in drop_hashes {
            self.drops.remove(&hash);
        }

        // Remove the campaign
        self.campaigns.remove(&campaign_id);
    }

    pub fn get_all_drops(&self) -> Vec<Drop> {
        self.drops
            .iter()
            .map(|(_, drop)| drop.clone())
            .collect()
    }
}
