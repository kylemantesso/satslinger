use near_sdk::{
    env::{self},
    json_types::U128,
    log, near, require,
    store::{IterableMap, LookupMap},
    AccountId, Allowance, Gas, NearToken, PanicOnDefault, Promise, PromiseError, PublicKey,
    serde_json, bs58,
};
use omni_transaction::bitcoin::bitcoin_transaction::BitcoinTransaction;
use omni_transaction::bitcoin::types::{ScriptBuf, TransactionType};
use omni_transaction::bitcoin::utils::{build_script_sig, serialize_ecdsa_signature_from_str};
mod bitcoin_tx;
mod ecdsa;
mod external;
mod utils;

const MPC_CONTRACT_ACCOUNT_ID: &str = "v1.signer-prod.testnet";
const MPC_GAS: Gas = Gas::from_tgas(100);
const MPC_ATTACHED_DEPOSIT: NearToken = NearToken::from_yoctonear(500000000000000000000000);

const CALLBACK_GAS: Gas = Gas::from_tgas(100);
pub const ACCESS_KEY_METHODS: &str = "claim";
pub const ACCESS_KEY_ALLOWANCE: NearToken = NearToken::from_near(1);

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Campaign {
    creator: AccountId,
    funding_path: String,
    funding_address: String,
    created_at: u64,
    search_terms: Vec<String>,
    instruction: String,
    twitter_handle: String,
}

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Drop {
    campaign_id: u128,
    target: u8,
    amount: u128,
    funder: String,
    path: String,
    keys: Vec<String>,
    op_return_hex: Option<String>,
    target_twitter_handle: String,
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
    pub drop_id: u128,
    pub campaigns: IterableMap<u128, Campaign>,
    pub drops: IterableMap<u128, Drop>,
    pub drop_by_key: LookupMap<String, u128>,
    pub auth_public_key: String,
    pub drop_by_hash: LookupMap<String, u128>,
}

#[near]
impl Contract {
    #[init]
    #[private]
    pub fn init(owner_id: AccountId, auth_public_key: String) -> Self {
        Self {
            owner_id,
            campaign_id: 0,
            drop_id: 0,
            campaigns: IterableMap::new(b"a"),
            drops: IterableMap::new(b"b"),
            drop_by_key: LookupMap::new(b"c"),
            auth_public_key,
            drop_by_hash: LookupMap::new(b"h"),
        }
    }

    /// Create a new campaign and get its funding address
    pub fn create_campaign(
        &mut self,
        funding_address: String,
        search_terms: Vec<String>,
        instruction: String,
        twitter_handle: String,
    ) -> String {
        let creator = env::predecessor_account_id();
        // Generate funding path and address for this campaign
        let funding_path = format!("m/44'/0'/{}'/0/0", self.campaign_id);
        // Store campaign info immediately with empty address
        let campaign_id = self.campaign_id;
        self.campaign_id += 1;
        let campaign = Campaign {
            creator,
            funding_path: funding_path.clone(),
            funding_address,
            created_at: env::block_timestamp(),
            search_terms,
            instruction,
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
        key: String,
        hash: String,
    ) -> u128 {
        require!(
            env::predecessor_account_id() == self.owner_id,
            "Only the contract owner can add drops"
        );

        let campaign = self.campaigns.get(&campaign_id)
            .expect("Campaign not found");

        // Generate unique path for this drop
        let drop_path = format!("m/44'/0'/{}'/0/{}", campaign_id, self.drop_id);
        self.drop_id += 1;

        // Store the drop without the secret key
        self.drops.insert(
            self.drop_id,
            Drop {
                campaign_id,
                target: 1,
                amount: amount.0,
                funder: campaign.funding_address.clone(),
                path: drop_path,
                keys: vec![key.clone()],
                op_return_hex: None,
                target_twitter_handle,
                hash: hash.clone(),
                claimed: false,
                claimed_by: None,
            },
        );

        // Use cloned hash here
        self.drop_by_hash.insert(hash.clone(), self.drop_id);

        // Add the key mapping
        self.drop_by_key.insert(key.clone(), self.drop_id);

        // Set up the access key
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

        self.drop_id
    }

    pub fn claim(
        &mut self,
        txid_str: String,
        vout: u32,
        receiver: String,
        change: U128,
        twitter_proof: String,
    ) -> Promise {
        let key = String::from(&env::signer_account_pk());
        let drop_id = self.drop_by_key.get(&key).unwrap();
        let drop_info = self.drops.get(&drop_id).unwrap();

        // Verify the Twitter proof
        let proof = self.verify_twitter_proof(&twitter_proof)
            .expect("Invalid Twitter proof");

        // Verify this is the target user
        require!(
            proof.handle == drop_info.target_twitter_handle,
            "Twitter handle does not match target handle"
        );

        log!("path {:?}", drop_info.path);
        log!("vout {:?}", vout);
        log!("funder {:?}", drop_info.funder);
        log!("receiver {:?}", receiver);
        log!("amount {:?}", drop_info.amount);
        log!("change {:?}", change.0);
        log!("op_return_hex {:?}", drop_info.op_return_hex);

        // Create the Bitcoin transaction
        let tx = bitcoin_tx::get_tx(
            &txid_str,
            vout,
            &drop_info.funder,
            &receiver,
            drop_info.amount,
            change.0,
            drop_info.op_return_hex.to_owned(),
        );

        // Get the pubkey hash from the funder address
        let pubkey_bytes = base58ck::decode_check(&drop_info.funder)
            .unwrap_or_else(|_| panic!("Failed to decode funder address"));

        let pubkey_hash = pubkey_bytes[1..].to_vec(); // Skip version byte and get pubkey hash

        // Prepare the transaction for signing
        let encoded_tx = bitcoin_tx::get_encoded_tx(tx.clone());
        let payload = bitcoin_tx::sha256d(encoded_tx);
        let key_version = 0;

        // Call ECDSA signer and pass the pubkey hash to callback
        ecdsa::get_sig(payload, drop_info.path.to_owned(), key_version).then(
            external::this_contract::ext(env::current_account_id())
                .with_static_gas(CALLBACK_GAS)
                .callback(tx, pubkey_hash)
        )
    }

    // View methods
    pub fn get_campaign(&self, campaign_id: u128) -> Option<Campaign> {
        self.campaigns.get(&campaign_id).cloned()
    }

    pub fn get_campaign_drops(&self, campaign_id: u128) -> Vec<u128> {
        self.drops
            .iter()
            .filter(|(_, drop)| drop.campaign_id == campaign_id)
            .map(|(id, _)| *id)
            .collect()
    }

    pub fn get_drop(&self, drop_id: u128) -> Option<Drop> {
        self.drops.get(&drop_id).cloned()
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

    fn verify_twitter_proof(&self, proof_b58: &str) -> Option<TwitterProof> {
        // Decode base58 proof
        let proof_bytes = bs58::decode(proof_b58).into_vec().ok()?;
        let proof: TwitterProof = serde_json::from_slice(&proof_bytes).ok()?;
        // Verify signature using auth service's public key
        let auth_public_key = hex::decode(&self.auth_public_key).ok()?;
        // Convert to fixed size array
        let auth_key_array: [u8; 32] = auth_public_key.try_into().ok()?;
        let message = format!("{}:{}", proof.handle, proof.timestamp);
        // Convert signature to fixed size array
        let sig_bytes = hex::decode(&proof.signature).ok()?;
        let sig_array: [u8; 64] = sig_bytes.try_into().ok()?;
        // Use ed25519_verify from near_sdk::env
        if env::ed25519_verify(&sig_array, message.as_bytes(), &auth_key_array) {
            Some(proof)
        } else {
            None
        }
    }

    #[private]
    pub fn remove_key_callback(&mut self) {
        // Implementation needed
    }

    #[private]
    pub fn callback(
        &mut self,
        #[callback_result] call_result: Result<external::SignatureResponse, PromiseError>,
        bitcoin_tx: BitcoinTransaction,
        pubkey_hash: Vec<u8>,  // This now receives the pubkey hash directly
    ) -> String {
        self.remove_key_callback();
        match call_result {
            Ok(signature_response) => {
                env::log_str(&format!(
                    "Successfully received signature: big_r = {:?}, s = {:?}, recovery_id = {}",
                    signature_response.big_r, signature_response.s, signature_response.recovery_id
                ));
                let signature = serialize_ecdsa_signature_from_str(
                    &signature_response.big_r.affine_point,
                    &signature_response.s.scalar,
                );
                let script_sig = build_script_sig(&signature, &pubkey_hash);
                let mut bitcoin_tx = bitcoin_tx;
                // Update the transaction with the script_sig
                let updated_tx = bitcoin_tx.build_with_script_sig(
                    0,
                    ScriptBuf(script_sig),
                    TransactionType::P2PKH,
                );
                // Serialise the updated transaction
                hex::encode(updated_tx)
            }
            Err(error) => {
                env::log_str(&format!("Callback failed with error: {:?}", error));
                "Callback failed".to_string()
            }
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

        // Remove all associated drops first
        let drop_ids: Vec<u128> = self.get_campaign_drops(campaign_id);
        for drop_id in drop_ids {
            if let Some(drop) = self.drops.get(&drop_id) {
                // Remove key mappings
                for key in &drop.keys {
                    self.drop_by_key.remove(key);
                }
                // Remove the drop
                self.drops.remove(&drop_id);
            }
        }

        // Remove the campaign
        self.campaigns.remove(&campaign_id);
    }

    /// Clear the contract state. Only callable by contract owner.
    pub fn clear_state(&mut self) {
        require!(
            env::predecessor_account_id() == self.owner_id,
            "Only the contract owner can clear state"
        );
        
        self.campaign_id = 0;
        self.drop_id = 0;
        self.campaigns = IterableMap::new(b"a");
        self.drops = IterableMap::new(b"b");
        self.drop_by_key = LookupMap::new(b"c");
        self.drop_by_hash = LookupMap::new(b"h");
    }

    pub fn get_drop_by_hash(&self, hash: String) -> Option<Drop> {
        match self.drop_by_hash.get(&hash) {
            Some(drop_id) => self.drops.get(&drop_id).cloned(),  // Add .cloned()
            None => None,
        }
    }
}
