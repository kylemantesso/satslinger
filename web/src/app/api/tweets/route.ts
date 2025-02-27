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
const CONTRACT_ID = 'satslinger.coldice4974.testnet';
const MINIMUM_AGE_HOURS = 72;
const XAI_API_KEY = process.env.XAI_API_KEY;

// Add NEAR account credentials to env vars
const NEAR_ACCOUNT_ID = process.env.SATSLINGER_ACCOUNT_ID!;
const NEAR_PRIVATE_KEY = process.env.SATSLINGER_PRIVATE!;

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
  const contractAccount = await near.account(CONTRACT_ID);

  // Fetch all campaigns from contract
  const campaigns = await contractAccount.viewFunction({
    contractId: CONTRACT_ID,
    methodName: 'get_campaigns',
    args: {}
  });

  if (!campaigns || campaigns.length === 0) {
    console.log('ℹ️ No campaigns found in contract');
    return [];
  }

  console.log('Campaigns:', campaigns.map(([id, campaign]) => ({
    id,
    search_terms: campaign.search_terms
  })));

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
    ${i}. Text: ${t.text}
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
  console.log(`Fetching tweets for campaign ${id} with search terms:`, campaign.search_terms);
  const query = buildTwitterQuery(campaign.search_terms);
  console.log(`Built Twitter query: ${query}`);
  
  const queryParams = new URLSearchParams({
    query,
    max_results: '20',
    'tweet.fields': 'created_at,author_id,public_metrics,text,id',
    'sort_order': 'relevancy'
  });

  const queryUrl = `${TWITTER_API_URL}?${queryParams.toString()}`;
  const currentTime = Math.floor(Date.now() / 1000);
  const minTimestamp = currentTime - (MINIMUM_AGE_HOURS * 60 * 60);
  console.log(`Using minimum timestamp: ${new Date(minTimestamp * 1000).toISOString()}`);

  try {
    console.log(`Making Twitter API request to: ${queryUrl}`);
    const response = await fetch(
      `${queryUrl}&start_time=${new Date(minTimestamp * 1000).toISOString()}`,
      {
        headers: { Authorization: `Bearer ${TWITTER_BEARER_TOKEN}` }
      }
    );
    const data = await response.json();
    console.log(`Twitter API response status: ${response.status}`);

    if (!response.ok) {
      console.error(`Twitter API error: ${data.message || 'Unknown error'}`);
      return { campaignId: id, results: { error: data.message || 'Failed to fetch tweets' } };
    }

    console.log(`Retrieved ${data.data?.length || 0} tweets from Twitter API`);
    
    // Get all tweet IDs
    const tweetIds = data.data?.map((tweet: Tweet) => tweet.id) || [];
    console.log(`Extracted ${tweetIds.length} tweet IDs`);
    
    // Get existing drops
    const existingDropTweetIds = await getExistingDrops(tweetIds);
    console.log(`Found ${existingDropTweetIds.length} existing drops for these tweets`);
    
    // Filter out tweets that already have drops
    const filteredTweets = data.data?.filter((tweet: Tweet) => 
      !existingDropTweetIds.includes(tweet.id)
    ) || [];
    console.log(`After filtering existing drops: ${filteredTweets.length} tweets remaining`);

    const scoredTweets = filteredTweets
      .map((tweet: Tweet) => ({
        ...tweet,
        engagement_score: calculateEngagementScore(tweet.public_metrics)
      }))
      .sort((a: Tweet, b: Tweet) => b.engagement_score - a.engagement_score);

    console.log(`Scored and sorted ${scoredTweets.length} tweets by engagement`);
    console.log('Top 3 tweets (excluding existing drops):', scoredTweets.slice(0, 3).map(t => ({
      id: t.id,
      text: t.text.substring(0, 50) + '...',
      engagement_score: t.engagement_score,
      metrics: t.public_metrics
    })));

    return { campaignId: id, tweets: scoredTweets.slice(0, 3) };
  } catch (err: any) {
    console.error(`Error fetching tweets for campaign ${id}:`, err);
    return { campaignId: id, results: { error: err.message || 'Error occurred' } };
  }
}

function calculateRewardAmount(tweet: Tweet): number {
  const { like_count, retweet_count, reply_count, quote_count } = tweet.public_metrics;
  
  // Base reward is 546 sats
  const baseReward = 546;
  
  // Calculate engagement multiplier (max 1.83x to keep the same range)
  const engagementMultiplier = Math.min(1.83, Math.floor(
    (like_count * 0.1 + 
     retweet_count * 0.4 + 
     reply_count * 0.3 + 
     quote_count * 0.4) / 10
  ) / 5);
  
  // Final reward between 546-1546 sats
  return Math.ceil(Math.min(1546, baseReward * (1 + engagementMultiplier)));
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
  hash: string,
  secretKey: string,
  tweetId: string,
  campaignId: string,
  twitterHandle: string
}) {
  const { data, error } = await supabase
    .from('drops')
    .insert({
      hash: dropData.hash,
      secret_key: dropData.secretKey,
      tweet_id: dropData.tweetId,
      campaign_id: dropData.campaignId,
      twitter_handle: dropData.twitterHandle
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to store drop:', error);
    throw error;
  }

  return data;
}

async function initKeyStore() {
  if (!NEAR_PRIVATE_KEY || !NEAR_ACCOUNT_ID) {
    throw new Error('Missing PRIVATE_KEY or ACCOUNT_ID in environment variables');
  }
  
  const keyPair = KeyPair.fromString(NEAR_PRIVATE_KEY);
  await keyStore.setKey('testnet', NEAR_ACCOUNT_ID, keyPair);
  
  return connect({
    networkId: 'testnet',
    keyStore,
    nodeUrl: 'https://rpc.testnet.near.org',
  });
}

// Add this function to fetch Twitter user details
async function getTwitterUser(userId: string): Promise<string> {
  const response = await fetch(
    `https://api.twitter.com/2/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`
      }
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch Twitter user');
  }

  const data = await response.json();
  return data.data.username;
}

async function createDropForWinner(params: { 
    campaignId: number; 
    amount: number; 
    twitterHandle: string;
    tweetId: string;
    hash: string; 
    publicKey: string;
    dropSecret: string;
}) {
    console.log('Creating drop with params:', params);
    
    try {
        console.log('Initializing keyStore with account:', NEAR_ACCOUNT_ID);
        const near = await initKeyStore();
        const account = await near.account(NEAR_ACCOUNT_ID);
        
        // First create the drop
        console.log(`Calling contract ${CONTRACT_ID} to add drop`);
        await account.functionCall({
            contractId: CONTRACT_ID,
            methodName: 'add_drop',
            args: {
                campaign_id: params.campaignId,
                amount: params.amount.toString(),
                // target_twitter_handle: params.twitterHandle,
                // target_tweet_id: params.tweetId,
                target_twitter_handle: "kylemantesso",
                target_tweet_id: "896618952914124800",
                hash: params.hash
            }
        });

        // Then add the key to the drop
        console.log(`Adding key to drop with hash ${params.hash}`);
        await account.functionCall({
            contractId: CONTRACT_ID,
            methodName: 'add_drop_key',
            args: {
                hash: params.hash,
                key: params.publicKey
            }
        });
        
        console.log('Successfully created drop and added key');
        return true;

    } catch (error) {
        console.error('Failed to create drop:', error);
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
  
  const hash = generateDropHash();
  const dropUrl = `${process.env.BASE_URL}/d/${hash}`;

  // First evaluate with XAI to get the winning tweet
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

  // Use the winning tweet index from XAI
  const winningTweet = campaignResult.tweets[evaluation.winningTweetIndex];
  const rewardAmount = rewardAmounts[evaluation.winningTweetIndex];

  // Get Twitter handle
  const twitterHandle = await getTwitterUser(winningTweet.author_id);

  // Generate key pair for drop using seed phrase
  const { secretKey: dropSecret } = generateSeedPhrase();
  const dropKeyPair = KeyPair.fromString(dropSecret);
  const publicKey = dropKeyPair.getPublicKey().toString();

  try {
    // Create the drop with handle instead of ID
    const drop = await createDropForWinner({
      campaignId: parseInt(campaignResult.campaignId),
      amount: rewardAmount,
      twitterHandle: twitterHandle,
      tweetId: winningTweet.id,
      hash,
      publicKey,
      dropSecret  // Pass through the secret
    });

    // Store drop details with secret key
    await storeDropDetails({
      hash,
      secretKey: dropSecret,  // Store the secret key
      tweetId: winningTweet.id,
      campaignId: campaignResult.campaignId,
      twitterHandle: twitterHandle
    });

    return {
      campaignId: campaignResult.campaignId,
      results: {
        winner: {
          tweet: winningTweet,
          reply: evaluation.reply,
          rewardAmount,
          drop: {
            publicKey,
            hash,
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
    console.log('Starting to process campaigns...');
    const campaigns = await getCampaigns();
    console.log(`Found ${campaigns.length} campaigns to process`);
    if (campaigns.length === 0) return NextResponse.json({ data: [] });

    // First fetch all tweets
    console.log('Fetching tweets for all campaigns...');
    const tweetResults = await Promise.all(
      campaigns.map(([id, campaign]: [string, Campaign]) => {
        console.log(`Fetching tweets for campaign ${id} with search terms: ${campaign.search_terms.join(', ')}`);
        return fetchTweetsForCampaign(campaign, id);
      })
    );

    // Then evaluate with XAI
    const evaluatedResults = await Promise.all(
      tweetResults.map((result, index) => {
        console.log(`Evaluating tweets for campaign ${campaigns[index][0]}`);
        return evaluateCampaignTweets(result, campaigns[index][1]);
      })
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
