#!/usr/bin/env node

import nacl from 'tweetnacl';
import bs58 from 'bs58';

// Set the handle and current timestamp (in seconds)
const handle = "example_user";
const timestamp = Math.floor(Date.now() / 1000);
const message = `${handle}:${timestamp}`;

console.log("=== Initialization ===");
console.log("Handle:", handle);
console.log("Timestamp:", timestamp);
console.log("Message:", message);

// The given DER-encoded private key
const AUTH_PRIVATE_KEY_DER = "302e020100300506032b657004220420b159e3c5414597fef0c98ea8c87061a1bae882da95b71fd16b719a2a846ef859";
console.log("\n=== DER-Encoded Private Key ===");
console.log("AUTH_PRIVATE_KEY_DER:", AUTH_PRIVATE_KEY_DER);

// In the DER structure, the private key seed is the part after the header.
// The header "302e020100300506032b657004220420" is removed to extract the 32-byte seed.
const derHeader = "302e020100300506032b657004220420";
console.log("DER Header:", derHeader);

const seedHex = AUTH_PRIVATE_KEY_DER.slice(derHeader.length);
console.log("Extracted Seed Hex:", seedHex);

const seed = Buffer.from(seedHex, 'hex');
console.log("Seed (as hex):", seed.toString('hex'));

// Generate the key pair from the seed.
// TweetNaCl expects a 32-byte seed and produces a 64-byte secretKey (seed + public key).
const keyPair = nacl.sign.keyPair.fromSeed(seed);
console.log("\n=== Generated Key Pair ===");
console.log("Public Key (hex):", Buffer.from(keyPair.publicKey).toString('hex'));

// --- Signing ---
// Convert the message to a Uint8Array and sign it using the secret key.
const messageUint8 = Buffer.from(message, 'utf8');
console.log("\n=== Signing Process ===");
console.log("Message Uint8 Array:", messageUint8);

const signature = nacl.sign.detached(messageUint8, keyPair.secretKey);
console.log("Raw Signature (Uint8Array):", signature);

const signatureHex = Buffer.from(signature).toString('hex');
console.log("Signature (hex):", signatureHex);

// Assemble the proof object.
const proof = {
  handle: handle,
  timestamp: timestamp,
  signature: signatureHex
};
console.log("\n=== Proof Object ===");
console.log("Proof:", proof);

// Serialize the proof as JSON and encode it in base58.
const proofJson = JSON.stringify(proof);
console.log("Proof JSON:", proofJson);

const proofBase58 = bs58.encode(Buffer.from(proofJson, 'utf8'));
console.log("Proof (base58 encoded):", proofBase58);

// --- Verification using Public Key ---
// Decode the base58 encoded proof.
console.log("\n=== Verification Process ===");
const decodedProofBuffer = bs58.decode(proofBase58);
console.log("Decoded Proof Buffer:", decodedProofBuffer);

const decodedProofJson = Buffer.from(decodedProofBuffer).toString('utf8');
console.log("Decoded Proof JSON String:", decodedProofJson);

const decodedProof = JSON.parse(decodedProofJson);
console.log("Decoded Proof Object:", decodedProof);

// Reconstruct the original message from the decoded proof.
const reconstructedMessage = `${decodedProof.handle}:${decodedProof.timestamp}`;
console.log("Reconstructed Message:", reconstructedMessage);

const reconstructedMessageUint8 = Buffer.from(reconstructedMessage, 'utf8');
console.log("Reconstructed Message Uint8 Array:", reconstructedMessageUint8);

// Convert the signature from hex back to a byte array.
const signatureBytes = Buffer.from(decodedProof.signature, 'hex');
console.log("Signature Bytes (from decoded proof):", signatureBytes);

// Verify the signature using tweetnacl's verification function and the public key.
const isValid = nacl.sign.detached.verify(
  reconstructedMessageUint8,
  signatureBytes,
  keyPair.publicKey
);

console.log("\n=== Verification Result ===");
console.log("Is signature valid?", isValid);

if (isValid) {
  console.log("Proof verified successfully using the public key!");
} else {
  console.log("Proof verification failed.");
}
