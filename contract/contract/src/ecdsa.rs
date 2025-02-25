use crate::*;
use external::{mpc_contract, SignRequest};

pub fn get_sig(payload: Vec<u8>, path: String, key_version: u32) -> Promise {
    let request = SignRequest {
        payload: utils::vec_to_fixed(payload),
        path,
        key_version,
    };
    mpc_contract::ext(MPC_CONTRACT_ACCOUNT_ID.parse().unwrap())
        .with_static_gas(MPC_GAS)
        .with_attached_deposit(MPC_ATTACHED_DEPOSIT)
        .sign(request)
}