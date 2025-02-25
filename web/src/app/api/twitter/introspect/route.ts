import { NextResponse } from 'next/server';

// Hardcoded test values
const TWITTER_CLIENT_ID = 'a3ZwdThiSnNmY3Flb3FNbU1xV246MTpjaQ';
const TWITTER_CLIENT_SECRET = 'nUQyGHqmfJnagXqxE4BCTd4ggCn80Iz3oNCZy4jY7R_YoshBx7';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    console.log('Using test credentials for introspection');
    const credentials = Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString('base64');
    console.log('Basic auth token:', credentials);
    
    const response = await fetch('https://api.twitter.com/2/oauth2/token/introspect', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `token=${token}`
    });

    console.log('Introspection response status:', response.status);
    const responseText = await response.text();
    console.log('Raw response:', responseText);

    try {
      const data = JSON.parse(responseText);
      console.log('Token introspection response:', data);
      return NextResponse.json(data);
    } catch (e) {
      console.error('Failed to parse response:', e);
      return NextResponse.json({ error: 'Invalid response format' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in token introspection:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
    }
    return NextResponse.json(
      { error: 'Failed to introspect token' },
      { status: 500 }
    );
  }
} 