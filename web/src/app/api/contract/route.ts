import { NextResponse } from 'next/server';
import { getCampaign } from './utils';
import { supabase } from './utils';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    console.log('Received webhook payload:', payload);

    const campaign = await getCampaign(payload.campaignId);
    console.log('Campaign:', campaign);

    const newCampaign = {
        id: parseInt(payload.campaignId),
        hashtags: campaign.hashtags,
        instruction: campaign.instruction,
      }

    console.log('New campaign:', newCampaign);

    // Add the campaign to the database using supabase
    const { data, error } = await supabase.from('campaign').upsert(newCampaign).select();

    if (error) {
        console.error('Full error details:', JSON.stringify(error, null, 2));
        throw error;
      }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing webhook:', (error as unknown as Error).message);
    return NextResponse.json(
      { success: false, error: (error as unknown as Error).message },
      { status: 500 }
    );
  }
}