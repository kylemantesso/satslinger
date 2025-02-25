import { NextResponse } from 'next/server';
import { connect, keyStores, utils } from 'near-api-js';
import { KeyPair } from 'near-api-js';
import { generateSeedPhrase } from 'near-seed-phrase';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const TWITTER_REFRESH_TOKEN = process.env.TWITTER_REFRESH_TOKEN!;
const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID!;
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET!;
const TWITTER_API_URL = 'https://api.twitter.com/2/tweets/search/recent';
const CONTRACT_ID = 'satslinger.testnet';
const MINIMUM_AGE_HOURS = 8;
const XAI_API_KEY = process.env.XAI_API_KEY;

// Add NEAR account credentials to env vars
const NEAR_ACCOUNT_ID = process.env.NEAR_ACCOUNT_ID!;
const NEAR_PRIVATE_KEY = process.env.NEAR_PRIVATE_KEY!;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Update NEAR connection setup
const keyStore = new keyStores.InMemoryKeyStore();
const config = {
  networkId: 'testnet',
  keyStore,
  nodeUrl: 'https://rpc.testnet.near.org',
  headers: {}
};

// Initialize the keyStore with account credentials
async function initializeKeyStore() {
  const keyPair = KeyPair.fromRandom('ed25519');
  const privateKey = NEAR_PRIVATE_KEY.replace('ed25519:', '');
  keyPair.secretKey = Buffer.from(privateKey, 'base64');
  await keyStore.setKey('testnet', NEAR_ACCOUNT_ID, keyPair);
}

type Campaign = {
  search_terms: string[];
  creator: string;
  funding_address: string;
  created_at: number;
  instruction: string;
  twitter_handle: string;
};

type Tweet = {
  id: string;
  text: string;
  public_metrics: any;
  engagement_score: number;
  author_id: string;
};

async function getCampaigns() {
  // Connect to NEAR
  const near = await connect(config);
  const account = await near.account(CONTRACT_ID);

  // Fetch all campaigns from contract
  const campaigns = await account.viewFunction({
    contractId: CONTRACT_ID,
    methodName: 'get_campaigns',
    args: {}
  });

  if (!campaigns || campaigns.length === 0) {
    console.log('ℹ️ No campaigns found in contract');
    return [];
  }

  return campaigns;
}

function calculateEngagementScore(metrics: { 
  like_count: number, 
  retweet_count: number, 
  reply_count: number, 
  quote_count: number 
}): number {
  return metrics.like_count + 
         metrics.retweet_count * 2 + 
         metrics.reply_count * 2 + 
         metrics.quote_count * 3;
}

async function evaluateTweetWithXAI(tweets: Tweet[], searchTerms: string[], rewardAmounts: number[], dropUrl: string) {
  if (!tweets.length) {
    console.log('No tweets to evaluate');
    return null;
  }

  const prompt = `
    Evaluate these tweets promoting: ${searchTerms.join(', ')}
    
    Tweets:
    ${tweets.map((t, i) => `
    ${i + 1}. Text: ${t.text}
    Engagement Score: ${t.engagement_score}
    Reward Amount: ${rewardAmounts[i]} sats
    `).join('\n')}

    Instructions:
    1. Choose the best tweet based on relevance and engagement
    2. As @SatSlinger (a friendly cowboy who automatically tips Bitcoin), generate a friendly reply congratulating them and mentioning their reward amount
    3. Include this claim link at the end: ${dropUrl}
    4. Keep the reply under 280 characters
    5. Use cowboy slang, emojis and keep it fun and friendly

    Important: Respond with valid JSON only, no backticks or markdown, in this exact format:
    {
      "winningTweetIndex": number,
      "reply": "your reply text"
    }
  `;

  try {
    console.log('Sending prompt to XAI:', prompt);
    
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${XAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'grok-2-1212',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    console.log('XAI response:', data);
    console.log('XAI message content:', data.choices?.[0]?.message?.content);

    if (!data.choices?.[0]?.message?.content) {
      console.error('Invalid XAI response format:', data);
      return null;
    }

    const content = data.choices[0].message.content.trim();
    try {
      return JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse XAI response content:', content);
      console.error('Parse error:', parseError);
      return null;
    }
  } catch (error) {
    console.error('Error in XAI evaluation:', error);
    return null;
  }
}

// Add this function to check for existing drops
async function getExistingDrops(tweetIds: string[]): Promise<string[]> {
  if (!tweetIds.length) return [];
  
  const { data, error } = await supabase
    .from('drops')
    .select('tweet_id')
    .in('tweet_id', tweetIds);

  if (error) {
    console.error('Error fetching existing drops:', error);
    return [];
  }

  return data.map(drop => drop.tweet_id);
}

async function fetchTweetsForCampaign(campaign: Campaign, id: string) {
  const query = buildTwitterQuery(campaign.search_terms);
  const queryParams = new URLSearchParams({
    query,
    max_results: '20',
    'tweet.fields': 'created_at,author_id,public_metrics,text,id',
    'sort_order': 'relevancy'
  });

  const queryUrl = `${TWITTER_API_URL}?${queryParams.toString()}`;
  const currentTime = Math.floor(Date.now() / 1000);
  const minTimestamp = currentTime - (MINIMUM_AGE_HOURS * 60 * 60);

  try {
    const response = await fetch(
      `${queryUrl}&start_time=${new Date(minTimestamp * 1000).toISOString()}`,
      {
        headers: { Authorization: `Bearer ${TWITTER_BEARER_TOKEN}` }
      }
    );
    const data = await response.json();

    if (!response.ok) {
      return { campaignId: id, results: { error: data.message || 'Failed to fetch tweets' } };
    }

    // Get all tweet IDs
    const tweetIds = data.data?.map((tweet: Tweet) => tweet.id) || [];
    
    // Get existing drops
    const existingDropTweetIds = await getExistingDrops(tweetIds);
    
    // Filter out tweets that already have drops
    const filteredTweets = data.data?.filter((tweet: Tweet) => 
      !existingDropTweetIds.includes(tweet.id)
    ) || [];

    const scoredTweets = filteredTweets
      .map((tweet: Tweet) => ({
        ...tweet,
        engagement_score: calculateEngagementScore(tweet.public_metrics)
      }))
      .sort((a: Tweet, b: Tweet) => b.engagement_score - a.engagement_score);

    console.log('Scored tweets (excluding existing drops):', scoredTweets.slice(0, 3));

    return { campaignId: id, tweets: scoredTweets.slice(0, 3) };
  } catch (err: any) {
    return { campaignId: id, results: { error: err.message || 'Error occurred' } };
  }
}

function calculateRewardAmount(tweet: Tweet): number {
  const { like_count, retweet_count, reply_count, quote_count } = tweet.public_metrics;
  
  // Base reward is 100 sats
  const baseReward = 100;
  
  // Calculate engagement multiplier (max 9x)
  const engagementMultiplier = Math.min(9, Math.floor(
    (like_count * 0.5 + 
     retweet_count * 2 + 
     reply_count * 1.5 + 
     quote_count * 2) / 10
  ));
  
  // Final reward between 100-1000 sats
  return Math.min(1000, baseReward * (1 + engagementMultiplier));
}

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

async function sendTweetReply(text: string, reply_to_tweet_id: string) {
  try {
    const access_token = await getAccessToken();

    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        reply: { in_reply_to_tweet_id: reply_to_tweet_id }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Twitter API error:', error);
      throw new Error(error.detail || 'Failed to send tweet');
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending tweet reply:', error);
    throw error;
  }
}

// Generate a short hash for the drop link
function generateDropHash(): string {
  return crypto.randomBytes(4).toString('hex');
}

async function storeDropDetails(dropData: {
  campaignId: string,
  tweetId: string,
  authorHandle: string,
  amount: number,
  publicKey: string,
  secretKey: string,
  hash: string
}) {
  const { data, error } = await supabase
    .from('drops')
    .insert({
      hash: dropData.hash,
      campaign_id: dropData.campaignId,
      tweet_id: dropData.tweetId,
      author_handle: dropData.authorHandle,
      amount: dropData.amount,
      public_key: dropData.publicKey,
      secret_key: dropData.secretKey,
      claimed: false,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to store drop:', error);
    throw error;
  }

  return data;
}

async function createDropForWinner(campaignId: string, amount: number, twitterHandle: string, tweetId: string) {
  try {
    console.log('Creating drop with params:', {
      campaignId,
      amount,
      twitterHandle,
      tweetId
    });

    // Generate hash first
    const hash = generateDropHash();
    console.log('Generated drop hash:', hash);

    // Initialize keyStore with credentials
    console.log('Initializing keyStore with account:', NEAR_ACCOUNT_ID);
    await initializeKeyStore();

    // Generate a new key pair for the drop
    console.log('Generating new key pair for drop');
    const { secretKey: dropSecret } = generateSeedPhrase();
    const keyPair = KeyPair.fromRandom('ed25519');
    keyPair.secretKey = Buffer.from(dropSecret.replace('ed25519:', ''), 'base64');
    const publicKey = keyPair.getPublicKey().toString();
    console.log('Generated public key:', publicKey);

    // Connect to NEAR with initialized keyStore
    console.log('Connecting to NEAR testnet');
    const near = await connect(config);
    const account = await near.account(NEAR_ACCOUNT_ID);
    console.log('Connected to NEAR account:', NEAR_ACCOUNT_ID);

    // Call the add_drop method with hash
    console.log('Calling add_drop with args:', {
      campaign_id: parseInt(campaignId),
      amount: amount.toString(),
      target_twitter_handle: twitterHandle,
      key: publicKey,
      hash
    });

    const result = await account.functionCall({
      contractId: CONTRACT_ID,
      methodName: 'add_drop',
      args: {
        campaign_id: parseInt(campaignId),
        amount: amount.toString(),
        target_twitter_handle: twitterHandle,
        key: publicKey,
        hash
      },
      gas: BigInt('300000000000000')
    });

    console.log('Contract call result:', result);

    // Store drop details in Supabase
    console.log('Storing drop details in Supabase');
    const storedDrop = await storeDropDetails({
      campaignId,
      tweetId,
      authorHandle: twitterHandle,
      amount,
      publicKey,
      secretKey: dropSecret,
      hash
    });

    console.log(`Successfully created drop for ${twitterHandle} with ${amount} satoshis`);
    return {
      dropSecret,
      publicKey,
      hash
    };
  } catch (error: unknown) {
    console.error('Failed to create drop:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

async function evaluateCampaignTweets(campaignResult: { campaignId: string, tweets: Tweet[] }, campaign: Campaign) {
  if (!campaignResult.tweets?.length) {
    console.log(`No tweets to evaluate for campaign ${campaignResult.campaignId}`);
    return campaignResult;
  }

  // Calculate rewards first
  const rewardAmounts = campaignResult.tweets.map(tweet => calculateRewardAmount(tweet));
  
  const winningIndex = 0; // For now, just use the highest engagement tweet
  const winningTweet = campaignResult.tweets[winningIndex];
  const rewardAmount = rewardAmounts[winningIndex];

  try {
    // Create the drop first
    const drop = await createDropForWinner(
      campaignResult.campaignId,
      rewardAmount,
      winningTweet.author_id,
      winningTweet.id
    );

    const dropUrl = `${process.env.BASE_URL}/d/${drop.hash}`;

    // Now evaluate with XAI including the drop URL
    const evaluation = await evaluateTweetWithXAI(
      campaignResult.tweets, 
      campaign.search_terms, 
      rewardAmounts,
      dropUrl
    );

    if (!evaluation) {
      return {
        campaignId: campaignResult.campaignId,
        results: { error: 'Failed to evaluate tweets' }
      };
    }

    // Simulate sending the tweet reply
    console.log('Would send reply tweet:', evaluation.reply);
    console.log('To tweet:', winningTweet.id);
    console.log('Successfully sent reply tweet (simulated)');
    console.log('Created drop with public key:', drop.publicKey);
    console.log('Drop URL:', dropUrl);

    return {
      campaignId: campaignResult.campaignId,
      results: {
        winner: {
          tweet: winningTweet,
          reply: evaluation.reply,
          rewardAmount,
          drop: {
            publicKey: drop.publicKey,
            hash: drop.hash,
            url: dropUrl
          }
        }
      }
    };
  } catch (error) {
    console.error('Failed to process winning tweet:', error);
    return {
      campaignId: campaignResult.campaignId,
      results: { error: 'Failed to create drop' }
    };
  }
}

export async function POST(request: Request) {
  if (!TWITTER_BEARER_TOKEN) {
    console.error('❌ Twitter API token not found');
    return NextResponse.json({ error: 'Twitter API token not configured' }, { status: 500 });
  }

  try {
    const campaigns = await getCampaigns();
    if (campaigns.length === 0) return NextResponse.json({ data: [] });

    // First fetch all tweets
    const tweetResults = await Promise.all(
      campaigns.map(([id, campaign]: [string, Campaign]) => 
        fetchTweetsForCampaign(campaign, id)
      )
    );

    // Then evaluate with XAI
    const evaluatedResults = await Promise.all(
      tweetResults.map((result, index) => 
        evaluateCampaignTweets(result, campaigns[index][1])
      )
    );

    return NextResponse.json({ data: evaluatedResults });
  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json({ error: 'Failed to process campaigns' }, { status: 500 });
  }
}

function buildTwitterQuery(searchTerms: string[], language = 'en'): string {
  // Format and clean search terms
  const formattedTerms = searchTerms
    .map(term => term.trim())
    .filter(term => term.length > 0)
    .filter(term => !term.startsWith('$'))
  
  // Remove duplicates
  const uniqueTerms = Array.from(new Set(formattedTerms));
  if (uniqueTerms.length === 0) return '';

  return `(${uniqueTerms.join(' OR ')}) -is:retweet lang:${language}`;
}
