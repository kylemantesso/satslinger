import { NextResponse } from "next/server";

export async function GET() {
    const pluginData = {
        openapi: "3.0.0",
        info: {
            title: "SatSlinger",
            description: "Bitcoin rewards for NEAR Protocol content on X",
            version: "1.0.0",
        },
        servers: [
            {
                url: process.env.BASE_URL || "http://localhost:3000",
            },
        ],
        "x-mb": {
            "account-id": process.env.SATSLINGER_ACCOUNT_ID,
            assistant: {
                name: "SatSlinger",
                description: "🤠 Howdy! I'm the fastest Bitcoin-tipping bot in the Wild West! I roam the digital frontier of X, slinging sats to reward the finest NEAR Protocol content.",
                instructions: "Talk like a friendly western sheriff. Use cowboy slang and keep it fun! Help folks set up their Bitcoin reward campaigns for NEAR Protocol content. When they want to create a campaign, use /api/campaign/create with their search terms and Twitter handle. Once they get their funding address, explain how to send their Bitcoin over yonder. Keep it western but clear - we don't want any confusion at the Bitcoin saloon! 🌵",
                tools: [{ type: "generate-transaction" }],
                "image": "https://satslinger.com/satslinger.png"
            },
        },
        paths: {
            "/api/tools/create-bitcoin-address": {
                get: {
                    summary: "Create a Bitcoin address for campaign funding",
                    description: "Generate a new Bitcoin address using MPC",
                    operationId: "createBitcoinAddress",
                    responses: {
                        "200": {
                            description: "Address created successfully",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            address: {
                                                type: "string",
                                                description: "Bitcoin address"
                                            },
                                            publicKey: {
                                                type: "string",
                                                description: "Public key"
                                            },
                                            mpcPath: {
                                                type: "string",
                                                description: "MPC path"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/tools/create-campaign": {
                get: {
                    summary: "Create a new reward campaign",
                    description: "Create a campaign using a previously generated Bitcoin address",
                    operationId: "createCampaign",
                    parameters: [
                        {
                            name: "searchTerms",
                            in: "query",
                            required: true,
                            schema: { type: "string" },
                            description: "Comma-separated keywords to search for in tweets"
                        },
                        {
                            name: "twitterHandle",
                            in: "query",
                            required: true,
                            schema: { type: "string" },
                            description: "Campaign creator's Twitter handle"
                        },
                        {
                            name: "fundingPublicKey",
                            in: "query",
                            required: true,
                            schema: { type: "string" },
                            description: "Bitcoin public key from create-bitcoin-address"
                        },
                        {
                            name: "mpcPath",
                            in: "query",
                            required: true,
                            schema: { type: "string" },
                            description: "MPC path from create-bitcoin-address"
                        }
                    ],
                    responses: {
                        "200": {
                            description: "Campaign creation prepared",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            transactionPayload: {
                                                type: "object",
                                                description: "NEAR transaction payload to create campaign"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/drop/get": {
                get: {
                    summary: "Get drop information by hash",
                    description: "Retrieve details about a specific drop using its hash",
                    operationId: "getDropByHash",
                    parameters: [
                        {
                            name: "hash",
                            in: "query",
                            required: true,
                            schema: { type: "string" },
                            description: "Unique hash identifier for the drop"
                        }
                    ],
                    responses: {
                        "200": {
                            description: "Drop information retrieved successfully",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            id: {
                                                type: "string",
                                                description: "Drop identifier"
                                            },
                                            amount: {
                                                type: "number",
                                                description: "Drop amount in satoshis"
                                            },
                                            status: {
                                                type: "string",
                                                description: "Current status of the drop (e.g., 'pending', 'claimed', 'expired')"
                                            },
                                            createdAt: {
                                                type: "string",
                                                format: "date-time",
                                                description: "Timestamp when the drop was created"
                                            },
                                            expiresAt: {
                                                type: "string",
                                                format: "date-time",
                                                description: "Timestamp when the drop expires"
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        "404": {
                            description: "Drop not found",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            error: {
                                                type: "string",
                                                description: "Error message"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    };

    return NextResponse.json(pluginData);
}