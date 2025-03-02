export const maxDuration = 300; // 5 minutes

import { NextResponse } from 'next/server';
import { connect, keyStores } from 'near-api-js';
import { KeyPair } from 'near-api-js';
import { generateSeedPhrase } from 'near-seed-phrase';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { RPC_URL, NETWORK_ID, CONTRACT_ID, config } from '@/utils/near';
import { Client } from "twitter-api-sdk";
import OAuth from 'oauth-1.0a';
import { TwitterApi } from 'twitter-api-v2';

const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const TWITTER_REFRESH_TOKEN = process.env.TWITTER_REFRESH_TOKEN!;
const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID!;
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET!;
const TWITTER_API_URL = 'https://api.twitter.com/2/tweets/search/recent';
const MINIMUM_AGE_HOURS = 144;
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

// Add logging helper
const log = (context: string, message: string, data?: any) => {
  console.log(`[${context}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
};

// Initialize Twitter client with credentials
log('Init', 'Initializing Twitter client with credentials');
const twitterClient = new TwitterApi({
  appKey: process.env.SATSLINGER_TWITTER_ACCESS_TOKEN!,
  appSecret: process.env.SATSLINGER_TWITTER_ACCESS_TOKEN_SECRET!,
  accessToken: process.env.SATSLINGER_TWITTER_ACCESS_TOKEN_CLIENT!,
  accessSecret: process.env.SATSLINGER_TWITTER_ACCESS_TOKEN_CLIENT_SECRET!,
});

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

type TweetResult = {
  campaignId: string;
  tweets?: Tweet[];
  error?: string;
};

async function getCampaigns() {
  log('getCampaigns', 'Starting to fetch campaigns');
  try {
    const near = await connect(config);
    log('getCampaigns', 'Connected to NEAR');
    
    const contractAccount = await near.account(CONTRACT_ID);
    log('getCampaigns', `Using contract account: ${CONTRACT_ID}`);

    const campaigns = await contractAccount.viewFunction({
      contractId: CONTRACT_ID,
      methodName: 'get_campaigns',
      args: {}
    });

    log('getCampaigns', `Found ${campaigns?.length || 0} campaigns`, campaigns);
    
    // Remove the first campaign from the list
    if (campaigns && campaigns.length > 0 && NETWORK_ID === 'mainnet') {
      campaigns.shift();
      log('getCampaigns', `Removed first campaign, now have ${campaigns.length} campaigns`);
    }
    
    return campaigns;
  } catch (error) {
    log('getCampaigns', 'Error fetching campaigns:', error);
    throw error;
  }
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

async function fetchTweetsForCampaign(campaign: Campaign, id: string): Promise<TweetResult> {
  log('fetchTweets', `Fetching tweets for campaign ${id}`, campaign);
  
  const query = buildTwitterQuery(campaign.search_terms);
  log('fetchTweets', 'Built query:', query);

  const queryParams = new URLSearchParams({
    query,
    max_results: '20',
    'tweet.fields': 'created_at,author_id,public_metrics,text,id',
    'sort_order': 'relevancy'
  });


  const currentTime = Math.floor(Date.now() / 1000);
  const minTimestamp = currentTime - (MINIMUM_AGE_HOURS * 60 * 60);
  log('fetchTweets', `Using time range: ${new Date(minTimestamp * 1000).toISOString()} to now`);

  try {
    const response = await fetch(
      `${TWITTER_API_URL}?${queryParams.toString()}&start_time=${new Date(minTimestamp * 1000).toISOString()}`,
      {
        headers: { Authorization: `Bearer ${TWITTER_BEARER_TOKEN}` }
      }
    );
    
    const data = await response.json();
    log('fetchTweets', `Twitter API response status: ${response.status}`, data);

    if (!response.ok) {
      log('fetchTweets', 'Twitter API error:', data);
      return { 
        campaignId: id, 
        error: data.message || 'Failed to fetch tweets'
      };
    }

    // Get existing drops
    const tweetIds = data.data?.map((tweet: Tweet) => tweet.id) || [];
    log('fetchTweets', `Found ${tweetIds.length} tweets`);
    
    const existingDropTweetIds = await getExistingDrops(tweetIds);
    log('fetchTweets', `Found ${existingDropTweetIds.length} existing drops`);

    const filteredTweets = data.data?.filter((tweet: Tweet) => 
      !existingDropTweetIds.includes(tweet.id)
    ) || [];
    
    const scoredTweets = filteredTweets
      .map((tweet: Tweet) => ({
        ...tweet,
        engagement_score: calculateEngagementScore(tweet.public_metrics)
      }))
      .filter((tweet: Tweet) => tweet.engagement_score > 0)
      .sort((a: Tweet, b: Tweet) => b.engagement_score - a.engagement_score);

    log('fetchTweets', `Final processed tweets: ${scoredTweets.length}`, 
      scoredTweets.slice(0, 3).map((t: any) => ({
        id: t.id,
        score: t.engagement_score,
        metrics: t.public_metrics
      }))
    );

    if (scoredTweets.length === 0) {
      return { campaignId: id, error: 'No tweets found' };
    }

    return { campaignId: id, tweets: scoredTweets.slice(0, 3) };
  } catch (error) {
    log('fetchTweets', `Error processing campaign ${id}:`, error);
    throw error;
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

// Update the sendTweetReply function
async function sendTweetReply(tweetText: string, inReplyToTweetId: string) {
  try {
    log('sendTweetReply', 'Starting tweet reply', {
      text: tweetText,
      replyTo: inReplyToTweetId
    });

    log('sendTweetReply', 'Twitter client credentials:', {
      appKey: process.env.SATSLINGER_TWITTER_ACCESS_TOKEN?.substring(0, 8) + '...',
      appSecret: process.env.SATSLINGER_TWITTER_ACCESS_TOKEN_SECRET?.substring(0, 8) + '...',
      accessToken: process.env.SATSLINGER_TWITTER_ACCESS_TOKEN_CLIENT?.substring(0, 8) + '...',
      accessSecret: process.env.SATSLINGER_TWITTER_ACCESS_TOKEN_CLIENT_SECRET?.substring(0, 8) + '...'
    });

    const response = await twitterClient.v2.reply(
      tweetText,
      process.env.SATSLINGER_REPLY_TWEET_ID ?? inReplyToTweetId
    );
    
    log('sendTweetReply', 'Tweet response:', response);
    return response;
  } catch (error) {
    log('sendTweetReply', 'Error sending tweet reply:', error);
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
  twitterHandle: string,
  amount: number
}) {
  const { data, error } = await supabase
    .from('drops')
    .insert({
      hash: dropData.hash,
      secret_key: dropData.secretKey,
      tweet_id: dropData.tweetId,
      campaign_id: dropData.campaignId,
      twitter_handle: dropData.twitterHandle,
      amount: dropData.amount
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
  
  const keyPair = KeyPair.fromString(NEAR_PRIVATE_KEY as any);
  await keyStore.setKey(NETWORK_ID, NEAR_ACCOUNT_ID, keyPair);
  
  return connect({
    networkId: NETWORK_ID,
    keyStore,
    nodeUrl: RPC_URL,
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
    log('createDropForWinner', 'Creating drop with params:', {
        ...params,
        dropSecret: '***' // Hide secret from logs
    });
    
    try {
        log('createDropForWinner', 'Initializing keyStore with account:', NEAR_ACCOUNT_ID);
        const near = await initKeyStore();
        const account = await near.account(NEAR_ACCOUNT_ID);
        
        // Override target handle and tweet ID if environment variables are set
        const targetHandle = process.env.SATSLINGER_TARGET_TWITTER_HANDLE ?? params.twitterHandle;
        const targetTweetId = process.env.SATSLINGER_TARGET_TWEET_ID ?? params.tweetId;

        log('createDropForWinner', 'Using target details:', {
            handle: targetHandle,
            tweetId: targetTweetId,
            originalHandle: params.twitterHandle,
            originalTweetId: params.tweetId
        });
        
        // First create the drop
        log('createDropForWinner', `Calling contract ${CONTRACT_ID} to add drop`);
        await account.functionCall({
            contractId: CONTRACT_ID,
            methodName: 'add_drop',
            args: {
                campaign_id: params.campaignId,
                amount: params.amount.toString(),
                target_twitter_handle: targetHandle,
                target_tweet_id: targetTweetId,
                hash: params.hash
            }
        });

        // Then add the key to the drop
        log('createDropForWinner', `Adding key to drop with hash ${params.hash}`);
        await account.functionCall({
            contractId: CONTRACT_ID,
            methodName: 'add_drop_key',
            args: {
                hash: params.hash,
                key: params.publicKey
            }
        });
        
        log('createDropForWinner', 'Successfully created drop and added key');
        return true;

    } catch (error) {
        log('createDropForWinner', 'Failed to create drop:', error);
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
  const dropKeyPair = KeyPair.fromString(dropSecret as any);
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
      secretKey: dropSecret,
      tweetId: winningTweet.id,
      campaignId: campaignResult.campaignId,
      twitterHandle: twitterHandle,
      amount: rewardAmount
    });

    // Send a tweet reply to notify the user
    try {
      await sendTweetReply(evaluation.reply, winningTweet.id);
      console.log(`Sent tweet reply about drop to @${twitterHandle}`);
    } catch (tweetError) {
      console.error('Failed to send tweet reply:', tweetError);
    }

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

// Add this helper function for delay
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

    const evaluatedResults = [];
    for (let i = 0; i < campaigns.length; i++) {
      const [id, campaign] = campaigns[i];
      if (id === '0') continue;

      console.log(`Fetching tweets for campaign ${id} with search terms: ${campaign.search_terms.join(', ')}`);
      const tweetResult = await fetchTweetsForCampaign(campaign, id);
      
      // Skip evaluation if there was an error or no tweets
      if (tweetResult.error || !tweetResult.tweets) {
        evaluatedResults.push({
          campaignId: id,
          results: { error: tweetResult.error || 'No tweets found' }
        });
        continue;
      }

      console.log(`Evaluating tweets for campaign ${id}`);
      const evaluatedResult = await evaluateCampaignTweets({
        campaignId: id,
        tweets: tweetResult.tweets
      }, campaign);
      evaluatedResults.push(evaluatedResult);

      if (i < campaigns.length - 1) {
        console.log('Waiting 5 seconds before processing next campaign...');
        await wait(5000);
      }
    }

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
