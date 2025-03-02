import { base_encode, base_decode } from 'near-api-js/lib/utils/serialize.js';
import * as EC from 'elliptic';
import * as jsSha3 from 'js-sha3';
const { sha3_256 } = jsSha3;
import hash from 'hash.js';
import bs58check from 'bs58check';
import keccak from 'keccak';
import { generateSeedPhrase } from 'near-seed-phrase';
import crypto from 'crypto';

interface BtcAddressParams {
    childPublicKey: string;
    isTestnet?: boolean;
}

interface AddressParams {
    publicKey: string;
    accountId: string;
    path: string;
    chain: 'bitcoin' | 'btc' | 'evm' | 'near' | 'dogecoin';
}

interface NearImplicitResult {
    implicitAccountId: string;
    implicitSecpPublicKey: string;
    implicitAccountSecretKey: string;
}

interface AddressResult {
    address: string;
    publicKey: string;
    nearSecpPublicKey?: string;
    nearImplicitSecretKey?: string;
}

export function najPublicKeyStrToUncompressedHexPoint(najPublicKeyStr: string): string {
    console.log('Input public key:', najPublicKeyStr);
    
    // Check if the key is in the expected format
    if (!najPublicKeyStr || typeof najPublicKeyStr !== 'string') {
        console.error('Invalid public key format:', najPublicKeyStr);
        throw new Error(`Invalid public key format: ${najPublicKeyStr}`);
    }
    
    // Handle case where the key doesn't contain a colon
    const parts = najPublicKeyStr.split(':');
    if (parts.length !== 2) {
        console.error('Public key does not contain expected format (curve:data):', najPublicKeyStr);
        
        // If it's already a hex string without the prefix, try to use it directly
        if (/^[0-9a-fA-F]+$/.test(najPublicKeyStr)) {
            console.log('Treating input as raw hex data');
            return '04' + najPublicKeyStr;
        }
        
        throw new Error(`Public key does not contain expected format (curve:data): ${najPublicKeyStr}`);
    }
    
    try {
        const decodedKey = base_decode(parts[1]);
        const hexResult = '04' + Buffer.from(decodedKey).toString('hex');
        console.log('Converted to uncompressed hex point:', hexResult);
        return hexResult;
    } catch (error: any) {
        console.error('Error decoding public key:', error);
        throw new Error(`Error decoding public key: ${error.message}`);
    }
}

export async function deriveChildPublicKey(
    parentUncompressedPublicKeyHex: string,
    signerId: string,
    path: string = '',
): Promise<string> {
    const ec = new EC.ec('secp256k1');
    const scalarHex = sha3_256(
        `near-mpc-recovery v0.1.0 epsilon derivation:${signerId},${path}`,
    );

    const x = parentUncompressedPublicKeyHex.substring(2, 66);
    const y = parentUncompressedPublicKeyHex.substring(66);

    const oldPublicKeyPoint = ec.curve.point(x, y);
    const scalarTimesG = ec.g.mul(scalarHex);
    const newPublicKeyPoint = oldPublicKeyPoint.add(scalarTimesG);
    
    const newX = newPublicKeyPoint.getX().toString('hex').padStart(64, '0');
    const newY = newPublicKeyPoint.getY().toString('hex').padStart(64, '0');
    return '04' + newX + newY;
}

export async function uncompressedHexPointToBtcAddress(
    uncompressedHexPoint: string,
    networkByte: Buffer,
): Promise<string> {
    const publicKeyBytes = Uint8Array.from(
        Buffer.from(uncompressedHexPoint, 'hex'),
    );
    const sha256HashOutput = await crypto.subtle.digest(
        'SHA-256',
        publicKeyBytes,
    );

    const ripemd160 = hash
        .ripemd160()
        .update(Buffer.from(sha256HashOutput))
        .digest();

    const networkByteAndRipemd160 = Buffer.concat([
        networkByte,
        Buffer.from(ripemd160),
    ]);

    return bs58check.encode(networkByteAndRipemd160);
}

export async function generateBtcAddress({ childPublicKey, isTestnet = true }: BtcAddressParams): Promise<string> {
    const networkId = process.env.NETWORK_ID;
    const isTestnetNew = networkId === 'testnet';
    const networkByte = Buffer.from([isTestnetNew ? 0x6f : 0x00]);
    return uncompressedHexPointToBtcAddress(childPublicKey, networkByte);
}

function uncompressedHexPointToEvmAddress(uncompressedHexPoint: string): string {
    const address = keccak('keccak256')
        .update(Buffer.from(uncompressedHexPoint.substring(2), 'hex'))
        .digest('hex');

    return '0x' + address.substring(address.length - 40);
}

async function uncompressedHexPointToNearImplicit(uncompressedHexPoint: string): Promise<NearImplicitResult> {
    const implicitSecpPublicKey =
        'secp256k1:' +
        base_encode(Buffer.from(uncompressedHexPoint.substring(2), 'hex'));

    const sha256HashOutput = await crypto.subtle.digest(
        'SHA-256',
        Buffer.from(uncompressedHexPoint, 'hex'),
    );
    const { publicKey, secretKey: implicitAccountSecretKey } =
        generateSeedPhrase(Buffer.from(sha256HashOutput));

    const implicitAccountId = Buffer.from(
        base_decode(publicKey.split(':')[1]),
    ).toString('hex');

    return {
        implicitAccountId,
        implicitSecpPublicKey,
        implicitAccountSecretKey,
    };
}

export async function generateAddress({ publicKey, accountId, path, chain }: AddressParams): Promise<AddressResult> {
    console.log('accountId', accountId);
    console.log('path', path);
    console.log('chain', chain);

    let childPublicKey = await deriveChildPublicKey(
        najPublicKeyStrToUncompressedHexPoint(publicKey),
        accountId,
        path,
    );

    if (!chain) chain = 'evm';
    let address: string, nearSecpPublicKey: string | undefined, nearImplicitSecretKey: string | undefined;
    
    switch (chain) {
        case 'evm':
            address = uncompressedHexPointToEvmAddress(childPublicKey);
            break;
        case 'btc':
            address = await generateBtcAddress({
                childPublicKey,
                isTestnet: false,
            });
            break;
        case 'bitcoin':
            address = await generateBtcAddress({
                childPublicKey,
                isTestnet: true,
            });
            break;
        case 'dogecoin':
            address = await uncompressedHexPointToBtcAddress(
                childPublicKey,
                Buffer.from([0x71]),
            );
            break;
        case 'near':
            const {
                implicitAccountId,
                implicitSecpPublicKey,
                implicitAccountSecretKey,
            } = await uncompressedHexPointToNearImplicit(childPublicKey);
            address = implicitAccountId;
            nearSecpPublicKey = implicitSecpPublicKey;
            nearImplicitSecretKey = implicitAccountSecretKey;
            break;
        default:
            throw new Error(`Unsupported chain: ${chain}`);
    }

    return {
        address,
        publicKey: childPublicKey,
        nearSecpPublicKey,
        nearImplicitSecretKey,
    };
}
