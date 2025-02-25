use crate::*;
use base58ck;
use near_sdk::env::sha256;
use omni_transaction::bitcoin::bitcoin_transaction::BitcoinTransaction;
use omni_transaction::bitcoin::types::{
    Amount, EcdsaSighashType, Hash, LockTime, OutPoint, ScriptBuf, Sequence, TxIn,
    TxOut, Txid, Version, Witness,
};
use omni_transaction::transaction_builder::TransactionBuilder;
use omni_transaction::transaction_builder::TxBuilder;
use omni_transaction::types::BITCOIN;
use hex::{encode, decode};

pub fn sha256d(encoded_tx: Vec<u8>) -> Vec<u8> {
    sha256(&sha256(&encoded_tx))
}

pub fn get_encoded_tx(tx: BitcoinTransaction) -> Vec<u8> {
    tx.build_for_signing_legacy(EcdsaSighashType::All)
}

pub fn get_tx(
    txid_str: &str,
    vout: u32,
    funder: &str,
    receiver: &str,
    amount: u128,
    change: u128,
    op_return_hex: Option<String>,
) -> BitcoinTransaction {
    // Log parameters for debugging
    log!("Creating Bitcoin transaction:");
    log!("txid: {}", txid_str);
    log!("vout: {}", vout);
    log!("funder address: {}", funder);
    log!("receiver address: {}", receiver);
    log!("amount: {}", amount);
    log!("change: {}", change);
    
    // Validate and parse txid
    require!(
        txid_str.chars().all(|c| c.is_ascii_hexdigit()),
        format!("Transaction ID contains invalid hex characters: {}", txid_str)
    );
    let hash = Hash::from_hex(txid_str)
        .unwrap_or_else(|e| panic!("Failed to parse transaction ID: {}", e));
    let txid = Txid(hash);

    // Get script pubkeys for both addresses
    log!("Generating script pubkey for funder address");
    let funder_script_pubkey = p2pkh_script_from_address(funder);
    log!("Generated funder script pubkey");
    
    log!("Generating script pubkey for receiver address");
    let receiver_script_pubkey = p2pkh_script_from_address(receiver);
    log!("Generated receiver script pubkey");

    let txin: TxIn = TxIn {
        previous_output: OutPoint::new(txid, vout),
        script_sig: funder_script_pubkey.clone(),
        sequence: Sequence::MAX,
        witness: Witness::default(),
    };

    let mut outputs = vec![];

    // Validate amounts
    const MAX_SATOSHIS: u128 = 21_000_000 * 100_000_000; // 21M BTC in satoshis
    require!(
        amount <= MAX_SATOSHIS,
        format!("Amount {} exceeds maximum possible Bitcoin amount", amount)
    );
    require!(
        change <= MAX_SATOSHIS,
        format!("Change amount {} exceeds maximum possible Bitcoin amount", change)
    );

    // The spend output
    let spend_txout: TxOut = TxOut {
        value: Amount::from_sat(amount as u64),
        script_pubkey: receiver_script_pubkey,
    };
    outputs.push(spend_txout);

    // The change output
    let change_txout = TxOut {
        value: Amount::from_sat(change as u64),
        script_pubkey: funder_script_pubkey,
    };
    outputs.push(change_txout);

    log!("Created main transaction outputs");

    // Add OP_RETURN output if provided
    if let Some(op_return_hex) = op_return_hex {
        require!(
            op_return_hex.len() <= 160,  // 80 bytes in hex
            "OP_RETURN data too large"
        );
        let data = decode(&op_return_hex)
            .expect("Invalid hex string for OP_RETURN data");
        let mut return_data = vec![0x6a, data.len() as u8];
        return_data.extend_from_slice(&data);

        let op_return_txout = TxOut {
            value: Amount::from_sat(0),
            script_pubkey: ScriptBuf::from_bytes(return_data),
        };
        outputs.push(op_return_txout);
        log!("Added OP_RETURN output");
    }

    // Build and return the transaction
    log!("Building final transaction");
    TransactionBuilder::new::<BITCOIN>()
        .version(Version::One)
        .inputs(vec![txin])
        .outputs(outputs)
        .lock_time(LockTime::from_height(0).unwrap())
        .build()
}

pub fn p2pkh_script_from_address(address: &str) -> ScriptBuf {
    log!("Creating P2PKH script for address: {}", address);
    
    // Decode the base58check address
    let decoded = base58ck::decode_check(address)
        .unwrap_or_else(|_| panic!("Failed to decode address: {}", address));
    
    // Skip version byte and use the remaining 20 bytes (RIPEMD160 hash)
    let hash160 = &decoded[1..];
    
    // Build P2PKH script:
    // OP_DUP OP_HASH160 <pubkeyhash> OP_EQUALVERIFY OP_CHECKSIG
    let mut script_pubkey: Vec<u8> = vec![0x76, 0xa9, hash160.len() as u8];
    script_pubkey.extend_from_slice(hash160);
    script_pubkey.extend_from_slice(&[0x88, 0xac]);

    log!("Generated script_pubkey: {}", encode(&script_pubkey));
    
    ScriptBuf::from_bytes(script_pubkey)
}