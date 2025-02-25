import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function GET(
  request: Request,
  { params }: { params: { hash: string } }
) {
  try {
    // Fetch drop details from Supabase
    const { data: drop, error } = await supabase
      .from('drops')
      .select(`
        hash,
        campaign_id,
        tweet_id,
        author_handle,
        amount,
        public_key,
        claimed,
        created_at
      `)
      .eq('hash', params.hash)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch drop' },
        { status: 500 }
      );
    }

    if (!drop) {
      return NextResponse.json(
        { error: 'Drop not found' },
        { status: 404 }
      );
    }

    console.log('Drop:', drop);

    return NextResponse.json({
      drop: {
        ...drop,
        claim_url: `${process.env.NEXT_PUBLIC_BASE_URL}/claim/${drop.hash}`
      }
    });

  } catch (error) {
    console.error('Error in drop route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 