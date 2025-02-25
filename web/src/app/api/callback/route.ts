import { NextResponse } from 'next/server';

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID!;
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET!;
const TWITTER_CALLBACK_URL = process.env.TWITTER_CALLBACK_URL!;

async function getTwitterUserData(accessToken: string) {
  console.log('Making request with token:', accessToken.slice(0, 10) + '...');
  
  const response = await fetch('https://api.twitter.com/2/users/me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Twitter API error response:', {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: errorText,
      url: response.url
    });
    throw new Error(`Twitter API error: ${response.status} - ${errorText}`);
  }

  const userData = await response.json();
  console.log('Twitter API response:', userData);
  
  if (!userData.data) {
    throw new Error('No user data in response');
  }

  return userData.data;
}

export async function POST(request: Request) {
  try {
    console.log('Twitter callback POST request received');
    const { code, code_verifier } = await request.json();

    console.log('Received code:', code ? 'yes' : 'no');
    console.log('Received code_verifier:', code_verifier ? 'yes' : 'no');

    if (!code || !code_verifier) {
      console.error('Missing required parameters:', { code: !!code, code_verifier: !!code_verifier });
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    console.log('Exchanging code for token with code_verifier:', code_verifier);
    console.log('Using callback URL:', TWITTER_CALLBACK_URL);

    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: TWITTER_CLIENT_ID,
        redirect_uri: TWITTER_CALLBACK_URL,
        code_verifier
      }).toString()
    });

    console.log('Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      console.error('Response status:', tokenResponse.status);
      console.error('Response headers:', Object.fromEntries(tokenResponse.headers.entries()));
      return NextResponse.json(
        { error: 'Failed to exchange code for token' },
        { status: 500 }
      );
    }

    const tokenData = await tokenResponse.json();
    console.log('Successfully obtained access token');
    console.log('Token type:', tokenData.token_type);
    console.log('Expires in:', tokenData.expires_in);

    if (tokenData.token_type !== 'bearer') {
      console.error('Unexpected token type:', tokenData.token_type);
      throw new Error('Invalid token type received');
    }

    const userData = await getTwitterUserData(tokenData.access_token);
    console.log('Received user data:', userData);

    return NextResponse.json({
      success: true,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      user: {
        id: userData.id,
        handle: userData.username,
        name: userData.name
      }
    });

  } catch (error) {
    console.error('Error in token exchange:', error);
    console.error('Error details:', {
      name: (error as Error).name,
      message: (error as Error).message,
      stack: (error as Error).stack
    });
    return NextResponse.json(
      { error: 'Failed to exchange token' },
      { status: 500 }
    );
  }
}