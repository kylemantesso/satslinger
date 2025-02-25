import { startStream } from '@near-lake/framework';
import fetch from 'node-fetch';

const CONTRACT_ID = 'satslinger.testnet';
// const API_ENDPOINT = 'https://tipper-agent.vercel.app/api/contract';
const API_ENDPOINT = 'http://localhost:3000/api/contract';

async function handleStreamerMessage(block) {
    try {
        const blockHeight = block.streamerMessage.block.header.height;

        // Only show periodic block updates
        if (blockHeight % 5 === 0) {
            console.log(`Processing block ${blockHeight}`);
        }

        // Process each shard
        if (block.streamerMessage.shards) {
            for (const shard of block.streamerMessage.shards) {
                if (shard.receiptExecutionOutcomes) {
                    for (const outcome of shard.receiptExecutionOutcomes) {
                        const receipt = outcome.receipt;
                        
                        if (receipt.receiverId === CONTRACT_ID) {
                            const actions = receipt.receipt.Action?.actions || [];
                            
                            for (const action of actions) {
                                if (action.FunctionCall?.methodName === 'create_campaign') {
                                    const timestamp = new Date(block.streamerMessage.block.header.timestamp / 1000000).toISOString();
                                    const executionOutcome = outcome.executionOutcome;
                                    const isSuccess = executionOutcome.outcome.status.SuccessValue !== undefined;
                                    
                                    // Extract campaign_id from the returned SuccessValue if available
                                    let campaignId = null;
                                    if (isSuccess) {
                                        const successValue = executionOutcome.outcome.status.SuccessValue;
                                        if (successValue) {
                                            const decoded = Buffer.from(successValue, 'base64').toString('utf8');
                                            try {
                                                // If the returned value is a JSON string that includes campaign_id
                                                const parsed = JSON.parse(decoded);
                                                campaignId = parsed.campaign_id || parsed;
                                            } catch (error) {
                                                // If the decoded value is a plain string (not JSON)
                                                campaignId = decoded;
                                            }
                                        }
                                    }
                                
                                    console.log('\n🎯 create_campaign detected!');
                                    console.log(`Block: ${blockHeight} (${timestamp})`);
                                    console.log(`Caller: ${receipt.predecessorId}`);
                                    console.log(`Status: ${isSuccess ? '✅ Success' : '❌ Failed'}`);
                                    console.log(`Campaign ID: ${campaignId}`);
                                
                                    const payload = {
                                        block: {
                                            height: blockHeight,
                                            timestamp: timestamp
                                        },
                                        caller: receipt.predecessorId,
                                        receiptId: receipt.receiptId, // sending receiptId for additional reference if needed
                                        campaignId, // include the campaign id here
                                        args: action.FunctionCall.args 
                                            ? JSON.parse(Buffer.from(action.FunctionCall.args, 'base64').toString('utf8'))
                                            : null,
                                        success: isSuccess,
                                        error: !isSuccess ? executionOutcome.outcome.status.Failure : null
                                    };
                                
                                    try {
                                        const response = await fetch(API_ENDPOINT, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(payload)
                                        });
                                
                                        if (!response.ok) {
                                            console.error('Failed to send notification:', response.status);
                                        }
                                    } catch (error) {
                                        console.error('Error sending notification:', error.message);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error processing block:', error.message);
    }
}

async function startIndexer() {
    try {
        // Fetch current block height from NEAR Testnet RPC
        const rpcUrl = 'https://rpc.testnet.near.org';
        const rpcResponse = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'dontcare',
                method: 'block',
                params: { finality: 'final' }
            })
        });
        const rpcData = await rpcResponse.json();
        const currentBlockHeight = rpcData.result.header.height;

        const lakeConfig = {
            s3BucketName: 'near-lake-data-testnet',
            s3RegionName: 'eu-central-1',
            startBlockHeight: currentBlockHeight,
            blocksPreloadPoolSize: 200
        };

        console.log('Starting create_campaign monitor');
        console.log(`Contract: ${CONTRACT_ID}`);
        console.log(`Starting from block: ${lakeConfig.startBlockHeight}\n`);
        
        await startStream(lakeConfig, handleStreamerMessage);
    } catch (error) {
        console.error('Fatal error:', error.message);
        process.exit(1);
    }
}

startIndexer();
