import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('drops')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    return Response.json(data.map(drop => ({
      id: drop.tweet_id,
      text: drop.tweet_text,
      author: drop.twitter_handle,
      amount: drop.amount,
      timestamp: drop.created_at
    })));
  } catch (error) {
    console.error('Failed to fetch recent rewards:', error);
    return Response.json([]);
  }
} 