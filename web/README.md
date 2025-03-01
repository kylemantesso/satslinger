# 🤠 SatSlinger

SatSlinger is a Bitcoin enabled AI agent that automatically rewards the best content on X with Bitcoin tips, using NEAR Protocol Chain Signatures. Create a campaign, tell the agent what you want to promote, and let the agent do the rest! Built for the One Trillion Agents Hackathon.

## 🌐 Links

- [Live Demo](https://satslinger.com)
- [Twitter Bot](https://twitter.com/SatSlinger)
- [Hackathon Submission](https://devpost.com/software/saslinger)

## 🌟 Core Features

### Bitcoin Reward System
- Automated tweet scoring based on engagement metrics
- Dynamic reward calculation (546-1546 sats) based on:
  - Likes (0.1x weight)
  - Retweets (0.4x weight)
  - Replies (0.3x weight)
  - Quote tweets (0.4x weight)
- ECDSA signature verification for secure Bitcoin transactions

### AI Agent using Bitte.ai
- Bitte AI Agent deployment at satslinger.com/agent
- Create your campaign using a chat interface
- Generate your bitcoin funding address

### AI Content Evaluation
- Automated content quality assessment
- Engagement scoring algorithm
- Smart filtering of relevant NEAR Protocol content
- Automated reward distribution decisions

### Drop System
- Secure claim links generation
- Twitter handle verification
- Bitcoin address validation
- UTXO management for rewards
- Transaction broadcasting

## 🛠 Technical Architecture

### Smart Contract (Rust)
- Campaign management for tracking reward campaigns
- Drop creation and management system
- Secure key storage for Bitcoin rewards
- Access control for campaign creators
- NEAR token integration for funding campaigns
- Cross-contract calls for reward distribution
- Storage management for efficient data handling

### Frontend Components
- **Tweet Component**: Embedded tweet display
- **Chat Interface**: AI agent interaction
- **Drop Page**: Reward claim interface
- **Twitter Auth**: OAuth2 PKCE flow

### API Routes
- `/api/tweets`: Tweet fetching and scoring
- `/api/agent`: AI agent endpoint
- `/api/twitter-auth`: Twitter authentication
- `/api/drop`: Drop management

## 🔐 Security Features

### Twitter Authentication
- OAuth 2.0 with PKCE
- State verification
- Token refresh handling
- Secure callback processing

### Bitcoin Security
- ECDSA signature verification
- UTXO validation
- Secure key management
- Transaction verification

## 🚀 Getting Started

### 1. Clone and install dependencies:

```bash
git clone https://github.com/kylemantesso/satslinger.git
cd satslinger/web
npm install
```

### 2. Configure environment variables:

```env
# NEAR Configuration
NEXT_PUBLIC_NEAR_NETWORK_ID=testnet
NEXT_PUBLIC_CONTRACT_ID=satslinger.testnet

# Twitter API Keys
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_BEARER_TOKEN=your_bearer_token

# Bitcoin Configuration
BITCOIN_NETWORK=testnet

# Base URL
BASE_URL=http://localhost:3000
```

### 3. Start development server:

```bash
npm run dev
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT License

## 📬 Contact

Follow [@SatSlinger](https://twitter.com/SatSlinger) on X for updates and support.

## 🙌 Credits

SatSlinger is built using open-source projects:
- [Agent Next Boilerplate](https://github.com/BitteProtocol/agent-next-boilerplate)
- [NEAR CS Linkdrop](https://github.com/mattlockyer/near-cs-linkdrop)