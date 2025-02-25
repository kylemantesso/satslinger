import { NextResponse } from 'next/server';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const AUTH_PRIVATE_KEY = process.env.AUTH_PRIVATE_KEY!;

function extractSeedFromDER(derKey: string): Uint8Array {
  const derHeader = "302e020100300506032b657004220420";
  const seedHex = derKey.slice(derHeader.length);
  return new Uint8Array(Buffer.from(seedHex, 'hex'));
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`Fetching Twitter user with ID/handle: ${params.id}`);
    const { id } = params;
    const authHeader = request.headers.get('Authorization');
    
    console.log('Received auth header:', authHeader ? 'present' : 'missing');
    
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('No valid authorization token provided');
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }
    const accessToken = authHeader.slice(7);
    console.log('Extracted access token:', accessToken.slice(0, 10) + '...');

    // Get user data with ID
    console.log(`Making request to Twitter API for user: ${id}`);
    const response = await fetch(`https://api.twitter.com/2/users/${id}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    console.log('Twitter API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Twitter API error response:', errorText);
      throw new Error(`Twitter API error: ${response.status} - ${errorText}`);
    }

    const userData = await response.json();
    console.log('Received Twitter user data:', userData);
    
    if (!userData.data?.username) {
      console.error('Missing required user data in Twitter response:', userData);
      throw new Error('Missing required user data');
    }

    // Generate proof
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `${userData.data.username}:${timestamp}`;
    console.log('Generating proof for message:', message);
    
    const seed = extractSeedFromDER(AUTH_PRIVATE_KEY);
    const keyPair = nacl.sign.keyPair.fromSeed(seed);
    
    const messageBytes = new Uint8Array(Buffer.from(message, 'utf8'));
    const signature = nacl.sign.detached(messageBytes, keyPair.secretKey);
    const signatureHex = Buffer.from(signature).toString('hex');

    const proof = {
      handle: userData.data.username,
      timestamp,
      signature: signatureHex
    };

    const proofJson = JSON.stringify(proof);
    const proofBase58 = bs58.encode(Buffer.from(proofJson, 'utf8'));
    
    console.log('Generated proof:', {
      message,
      proof,
      proofBase58: proofBase58.slice(0, 20) + '...'
    });

    const response_data = {
      id: userData.data.id,
      handle: userData.data.username,
      name: userData.data.name,
      proof: proofBase58
    };
    
    console.log('Returning user data with proof');
    return NextResponse.json(response_data);

  } catch (error) {
    console.error('Error in user endpoint:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
    }
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: 500 }
    );
  }
} 