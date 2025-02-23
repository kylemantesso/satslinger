import { NextResponse } from 'next/server';

const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const TWITTER_API_URL = 'https://api.twitter.com/2/tweets/search/recent';

export async function GET(request: Request) {
  console.log('🔄 Fetching tweets...');

  // Get search terms from URL parameters
  const { searchParams } = new URL(request.url);
  const terms = searchParams.get('terms')?.split(',').filter(Boolean);
  
  // If no terms provided, return empty result
  if (!terms?.length) {
    console.log('ℹ️ No search terms provided, returning empty result');
    return NextResponse.json({ data: [] });
  }

  if (!TWITTER_BEARER_TOKEN) {
    console.error('❌ Twitter API token not found in environment variables');
    return NextResponse.json(
      { error: 'Twitter API token not configured' },
      { status: 500 }
    );
  }

  try {
    console.log('🔍 Searching for terms:', terms);

    // Build the query string - combine terms with OR operator
    const query = terms.map(term => {
      // Add # if term doesn't start with it
      return term.startsWith('#') ? term : `#${term}`;
    }).join(' OR ');

    const queryUrl = `${TWITTER_API_URL}?query=${encodeURIComponent(query)}&max_results=20&tweet.fields=created_at,author_id,public_metrics`;
    console.log(`📡 Making request to: ${queryUrl}`);

    const response = await fetch(
      queryUrl,
      {
        headers: {
          Authorization: `Bearer ${TWITTER_BEARER_TOKEN}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Twitter API error:', {
        status: response.status,
        statusText: response.statusText,
        error: data
      });
      throw new Error(data.message || 'Failed to fetch tweets');
    }

    console.log(`✅ Successfully fetched ${data.data?.length || 0} tweets`);
    
    // Log rate limit information
    const rateLimit = {
      remaining: response.headers.get('x-rate-limit-remaining'),
      reset: response.headers.get('x-rate-limit-reset'),
      limit: response.headers.get('x-rate-limit-limit'),
    };
    console.log('📊 Rate limit info:', rateLimit);

    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Error fetching tweets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tweets' },
      { status: 500 }
    );
  }
} 