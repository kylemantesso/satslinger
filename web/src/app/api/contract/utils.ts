import { CONTRACT_ID, RPC_URL } from "@/utils/near";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

export const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);


export async function getCampaign(campaignId: number) {
    // Encode the campaign_id parameter into Base64
    const argsBase64 = Buffer.from(`{"campaign_id":${campaignId}}`).toString('base64');
    console.log('Args Base64:', argsBase64);
  
    // Make the POST request to the NEAR RPC endpoint
    const res = await fetch(RPC_URL, {
      headers: {
        "accept": "*/*",
        "accept-language": "en-AU,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
        "cache-control": "no-cache",
        "content-type": "application/json",
        "pragma": "no-cache",
        "priority": "u=1, i",
        "sec-ch-ua": "\"Not(A:Brand\";v=\"99\", \"Google Chrome\";v=\"133\", \"Chromium\";v=\"133\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"macOS\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site"
      },
      referrerPolicy: "same-origin",
      body: JSON.stringify({
        method: "query",
        params: {
          account_id: CONTRACT_ID,
          args_base64: argsBase64,
          finality: "optimistic",
          method_name: "get_campaign",
          request_type: "call_function"
        },
        id: 132,
        jsonrpc: "2.0"
      }),
      method: "POST",
      mode: "cors",
      credentials: "omit"
    });
  
    const data = await res.json();
  
    // Decode the byte array into a JSON string using Node.js Buffer
    const jsonString = Buffer.from(data.result.result).toString('utf8');
    const campaignData = JSON.parse(jsonString);
  
    return campaignData;
  }
  