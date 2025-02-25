import { NextResponse } from 'next/server';
import crypto from 'crypto';

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID!;
const TWITTER_CALLBACK_URL = process.env.TWITTER_CALLBACK_URL!;

// Generate a PKCE code verifier
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, ''); // Base64url encoding
}

// Generate a PKCE code challenge (SHA-256 hash of the verifier)
function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256')
    .update(verifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, ''); // Base64url encoding
}

export async function POST() {
  try {
    console.log('Initiating Twitter OAuth flow');
    
    const codeVerifier = generateCodeVerifier();
    console.log('Generated code verifier:', codeVerifier);
    
    const codeChallenge = generateCodeChallenge(codeVerifier);
    console.log('Generated code challenge:', codeChallenge);
    
    const state = crypto.randomBytes(16).toString('hex');
    console.log('Generated state:', state);

    const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', TWITTER_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', TWITTER_CALLBACK_URL);
    authUrl.searchParams.append('scope', 'users.read tweets.read');
    authUrl.searchParams.append('code_challenge', codeChallenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');
    authUrl.searchParams.append('state', state);
    
    console.log('Auth URL created:', authUrl.toString());
    console.log('Using callback URL:', TWITTER_CALLBACK_URL);

    return NextResponse.json({ 
      url: authUrl.toString(),
      code_verifier: codeVerifier,
      state
    });
  } catch (error) {
    console.error('Error initiating OAuth flow:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}
