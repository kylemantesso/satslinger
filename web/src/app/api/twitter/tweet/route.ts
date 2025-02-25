import { NextResponse } from 'next/server';

const TWITTER_REFRESH_TOKEN = process.env.TWITTER_REFRESH_TOKEN!;
const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID!;
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET!;

async function getAccessToken(): Promise<string> {
  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString('base64')}`
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: TWITTER_REFRESH_TOKEN
    }).toString()
  });

  if (!response.ok) {
    throw new Error('Failed to refresh access token');
  }

  const data = await response.json();
  return data.access_token;
}

export async function POST(request: Request) {
  try {
    const { text, reply_to_tweet_id } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Missing text' },
        { status: 400 }
      );
    }

    // Get fresh access token using the stored refresh token
    const access_token = await getAccessToken();

    const tweetData: any = {
      text
    };

    if (reply_to_tweet_id) {
      tweetData.reply = { in_reply_to_tweet_id: reply_to_tweet_id };
    }

    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tweetData)
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Twitter API error:', error);
      return NextResponse.json(
        { error: error.detail || 'Failed to send tweet' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error sending tweet:', error);
    return NextResponse.json(
      { error: 'Failed to send tweet' },
      { status: 500 }
    );
  }
} 