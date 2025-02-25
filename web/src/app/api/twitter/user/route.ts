import { NextResponse } from 'next/server';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID!;
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET!;
const AUTH_PRIVATE_KEY = process.env.AUTH_PRIVATE_KEY!;

// Extract the private key seed from DER format
function extractSeedFromDER(derKey: string): Uint8Array {
  const derHeader = "302e020100300506032b657004220420";
  const seedHex = derKey.slice(derHeader.length);
  return new Uint8Array(Buffer.from(seedHex, 'hex'));
}

async function getTwitterUserData(accessToken: string) {
  try {
    console.log('Fetching Twitter user data with token:', accessToken.slice(0, 10) + '...');
    
    // First get the user ID from /2/users/me
    const meResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    console.log('Me endpoint response status:', meResponse.status);
    const meText = await meResponse.text();
    console.log('Me endpoint response:', meText);

    if (!meResponse.ok) {
      throw new Error(`Twitter API error (me endpoint): ${meResponse.status} - ${meText}`);
    }

    const meData = JSON.parse(meText);
    const userId = meData.data?.id;

    if (!userId) {
      throw new Error('Could not get user ID from Twitter response');
    }

    // Then get the full user data using the ID
    const userResponse = await fetch(`https://api.twitter.com/2/users/${userId}?user.fields=id,name,username`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    console.log('User endpoint response status:', userResponse.status);
    const userText = await userResponse.text();
    console.log('User endpoint response:', userText);

    if (!userResponse.ok) {
      // Try to get more error details
      try {
        const errorData = JSON.parse(userText);
        console.error('Detailed Twitter API error:', errorData);
      } catch (e) {
        // If parsing fails, use raw text
      }
      throw new Error(`Twitter API error (user endpoint): ${userResponse.status} - ${userText}`);
    }

    try {
      const userData = JSON.parse(userText);
      console.log('Parsed Twitter user data:', userData);
      
      if (!userData.data?.username) {
        throw new Error('Missing required user data from Twitter response');
      }
      
      return userData.data;
    } catch (parseError) {
      console.error('Failed to parse Twitter response:', parseError);
      throw new Error('Invalid response format from Twitter');
    }
  } catch (error) {
    console.error('Error fetching Twitter user data:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
    }
    throw error;
  }
}

export async function GET(request: Request) {
  try {
    // Get access token from Authorization header
    const authHeader = request.headers.get('Authorization');
    console.log('Received auth header:', authHeader ? 'present' : 'missing');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const accessToken = authHeader.slice(7);
    console.log('Extracted access token:', accessToken.slice(0, 10) + '...');

    // Fetch Twitter user data
    const userData = await getTwitterUserData(accessToken);
    console.log('Twitter user data:', userData);

    // Generate proof
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `${userData.username}:${timestamp}`;
    console.log('Generating proof for message:', message);

    // Generate keypair from seed
    const seed = extractSeedFromDER(AUTH_PRIVATE_KEY);
    const keyPair = nacl.sign.keyPair.fromSeed(seed);
    
    // Sign the message
    const messageBytes = new Uint8Array(Buffer.from(message, 'utf8'));
    const signature = nacl.sign.detached(messageBytes, keyPair.secretKey);
    const signatureHex = Buffer.from(signature).toString('hex');

    // Create and encode proof
    const proof = {
      handle: userData.username,
      timestamp,
      signature: signatureHex
    };

    const proofJson = JSON.stringify(proof);
    const proofBase58 = bs58.encode(Buffer.from(proofJson, 'utf8'));

    console.log('Generated proof:', {
      message,
      proof,
      proofBase58
    });

    // Return user data and proof
    return NextResponse.json({
      id: userData.id,
      handle: userData.username,
      name: userData.name,
      proof: proofBase58
    });

  } catch (error) {
    console.error('Error in user endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: 500 }
    );
  }
} 