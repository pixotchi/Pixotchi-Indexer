# Pixotchi Game Indexer

A high-performance blockchain indexer for Pixotchi game events built with [Ponder](https://ponder.sh). This service indexes game activities from the Base blockchain and exposes them through a GraphQL API for fast, efficient querying by frontend applications.


## Overview

The Pixotchi Indexer monitors both the Pixotchi Router smart contract (`0xeb4e16c804AE9275a655AbBc20cD0658A91F9235`) and Land contract (`0x3f1F8F0C4BE4bCeB45E6597AFe0dE861B8c3278c`) on Base blockchain, providing a unified indexing solution for the complete Pixotchi gaming ecosystem. It indexes key game events including attacks, kills, mints, gameplay, item consumption, shop purchases, land management, plant cultivation, village/town production, and quest systems.


## Architecture

```
[Base Blockchain] → [Multiple RPC Providers] → [Ponder Indexer w/ Cache] → [PostgreSQL] → [GraphQL API] → [Frontend Apps]
                     ↓ Failover & Load Balancing ↓
            [Primary RPC] [Secondary RPC] [Fallback RPC]
```

### Components

1. **Event Listeners** (`src/PixotchiNFT.ts`, `src/LandNFT.ts`): Process raw blockchain events with caching
2. **Schema Definition** (`ponder.schema.ts`): Define unified database structure
3. **Configuration** (`ponder.config.ts`): Multi-RPC blockchain and contract settings
4. **API Layer** (`src/api/index.ts`): GraphQL endpoint with custom routes
5. **Smart Contract ABIs** (`abis/`): Contract interface definitions

## Indexed Events

The indexer tracks these key game events across both Pixotchi and Land systems:

### Pixotchi Events

#### Attack Events
- **What**: Player vs Player combat
- **Data**: Attacker, winner, loser IDs and names, scores won

#### Kill Events  
- **What**: When a Pixotchi dies from neglect
- **Data**: Killer address, dead Pixotchi ID, reward amount

#### Mint Events
- **What**: New Pixotchi births
- **Data**: NFT ID, timestamp

#### Played Events
- **What**: Minigame interactions
- **Data**: Pixotchi ID/name, game type, points gained/lost, time extensions

#### ItemConsumed Events
- **What**: Item usage (feeding, care items)
- **Data**: Pixotchi ID/name, item ID, giver address

#### ShopItemPurchased Events
- **What**: Shop transactions
- **Data**: Pixotchi ID/name, item ID, buyer address

### Land Events

#### Land Transfer Events
- **What**: Land NFT ownership changes
- **Data**: Land ID, from/to addresses, timestamp

#### Plant Lifecycle Events
- **What**: Plant lifetime and points management
- **Data**: Land ID, plant ID, lifetime changes, point assignments

#### Village Production Events
- **What**: Village building upgrades and resource production
- **Data**: Land ID, production claims, XP gains, speed-ups, leaf upgrades

#### Town Production Events
- **What**: Town-level building management
- **Data**: Land ID, town upgrades, seed speed-ups

#### Quest System Events
- **What**: Quest progression and completion
- **Data**: Land ID, quest starts/commits/finalizations/resets

#### Warehouse Events
- **What**: Warehouse plant management
- **Data**: Land ID, plant lifetime and points assignments

#### Land Management Events
- **What**: Land naming and minting
- **Data**: Land ID, new names, mint events

## 🔧 Technical Implementation

### Multi-RPC Reliability System

The indexer uses multiple RPC providers for maximum uptime and performance across both contracts:

```typescript
// ponder.config.ts - Enhanced reliability
chains: {
  base: {
    id: 8453,
    rpc: [
      process.env.PONDER_RPC_URL_BASE_1!,    // Primary RPC
      process.env.PONDER_RPC_URL_BASE_2!,    // Secondary RPC  
      process.env.PONDER_RPC_URL_BASE_3!,    // Fallback RPC
      process.env.PONDER_RPC_URL_BASE_4!,    // Additional fallback
    ].filter(Boolean),
    transport: http(),
  },
}
```

**Features**:
- **Automatic Failover**: Seamlessly switches between providers
- **Load Balancing**: Distributes requests across healthy endpoints
- **Health Monitoring**: Tracks provider performance and availability

### Enhanced Name Resolution with Caching

The indexer includes intelligent caching and retry logic for both Pixotchi names and land data:

```typescript
// Smart caching system
const PLANT_NAME_CACHE = new Map<string, { name: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getPlantName(chainId: number, eventBlockNumber: bigint, client: any, PixotchiNFT: any, input: bigint): Promise<string> {
  // Check cache first
  const cached = PLANT_NAME_CACHE.get(cacheKey);
  if (cached && isCacheValid(cached)) {
    return cached.name; // Instant response from cache
  }

  // Enhanced retry logic with exponential backoff
  const result = await withRetry(async () => {
    return await client.readContract({
      abi: PixotchiNFT.abi,
      address: PixotchiNFT.address, 
      functionName: "getPlantName",
      args: [input],
    });
  }, MAX_RETRIES, `getPlantName for NFT ${input}`);
  
  // Cache successful results
  PLANT_NAME_CACHE.set(cacheKey, { name: plantName, timestamp: Date.now() });
  return plantName;
}
```


### Smart Contract Integration

```typescript
contracts: {
  PixotchiNFT: {
    chain: "base",
    abi: PixotchiRouterAbi, // Comprehensive ABI covering all modules
    address: "0xeb4e16c804AE9275a655AbBc20cD0658A91F9235",
    startBlock: 33179676,
    maxBlockRange: 1000, // Optimized for performance
  },
  LandContract: {
    chain: "base",
    abi: LandAbi, // Complete land contract interface
    address: "0x3f1F8F0C4BE4bCeB45E6597AFe0dE861B8c3278c",
    startBlock: 33179676,
    maxBlockRange: 1000, // Optimized for performance
  },
}
```

### Transaction Bundler Support

**Critical Feature**: The indexer handles transaction bundlers (account abstraction) which can emit multiple events with the same transaction hash.

#### The Problem
Transaction bundlers can execute multiple operations in a single transaction, causing multiple events with identical `transaction.hash` values, leading to primary key violations.

#### The Solution
Uses Ponder's unique `event.id` instead of `transaction.hash` for primary keys:

```typescript
// ❌ Problematic (causes duplicates with bundlers)
id: event.transaction.hash

// ✅ Correct (always unique)
id: event.id  // 75-digit globally unique identifier
```

**Currently Applied To**: All event types for maximum bundler compatibility
**Supports**: Cross-game transactions (e.g., using Pixotchi items on Land plants)

## Deployment

### Environment Setup

** Required Environment Variables**

The indexer requires multiple RPC endpoints for reliability across both contracts.

#### Base Mainnet RPC URLs (4 for redundancy)
```bash
PONDER_RPC_URL_BASE_1=
PONDER_RPC_URL_BASE_2=
PONDER_RPC_URL_BASE_3=
PONDER_RPC_URL_BASE_4=
```

#### Base Sepolia Testnet RPC URLs (4 for redundancy)
```bash
PONDER_RPC_URL_TESTNET_1=
PONDER_RPC_URL_TESTNET_2=
PONDER_RPC_URL_TESTNET_3=
PONDER_RPC_URL_TESTNET_4=
```

#### Production (Railway)
```bash
# Database
DATABASE_URL=${{activities.DATABASE_URL}}  # Reference to PostgreSQL service

# Railway Deployment
RAILWAY_DEPLOYMENT_ID=your_deployment_id_here

# Start Command
npm run start:railway
```

#### Development
```bash
# Uses PGlite (embedded PostgreSQL)
npm run dev
```

#### Testnet
```bash
npm run start:testnet:railway
```

### Contract Addresses

#### Mainnet (Base)
- **Pixotchi Router**: `0xeb4e16c804AE9275a655AbBc20cD0658A91F9235`
- **Land Contract**: `0x3f1F8F0C4BE4bCeB45E6597AFe0dE861B8c3278c`

#### Testnet (Base Sepolia)
- **Pixotchi Router**: `0x1723a3F01895c207954d09F633a819c210d758c4`
- **Land Contract**: `0xBd4FB987Bcd42755a62dCf657a3022B8b17D5413`

### Database Schema Management

The indexer uses deployment-specific schemas to prevent conflicts:

```bash
# Production uses unique schema per deployment
ponder start --schema $RAILWAY_DEPLOYMENT_ID

# This creates isolated schemas like: f96fb7dd-9e35-4db3-8ed4-414c659d1f16
```

**Benefits**:
- Zero-downtime deployments
- Rollback safety
- Parallel environment testing

**Trade-off**: Database UI shows multiple schemas (old deployments persist for safety)

## 📡 API Usage

### GraphQL Endpoint
```
Production: https://api.mini.pixotchi.tech/graphql
```

### Query Examples

#### Unified Activity Feed
```graphql
query GetUnifiedActivityFeed {
  # Pixotchi Events
  attacks(orderBy: "timestamp", orderDirection: "desc", limit: 5) {
    items {
      __typename
      timestamp
      attackerName
      loserName
      scoresWon
    }
  }
  mints(orderBy: "timestamp", orderDirection: "desc", limit: 5) {
    items {
      __typename
      timestamp
      nftId
    }
  }
  playeds(orderBy: "timestamp", orderDirection: "desc", limit: 5) {
    items {
      __typename
      timestamp
      nftName
      gameName
      points
    }
  }
  
  # Land Events
  landTransferEvents(orderBy: "timestamp", orderDirection: "desc", limit: 5) {
    items {
      __typename
      timestamp
      landId
      from
      to
    }
  }
  plantLifetimeAssignedEvents(orderBy: "timestamp", orderDirection: "desc", limit: 5) {
    items {
      __typename
      timestamp
      landId
      plantId
      lifetime
      newLifetime
    }
  }
  villageProductionClaimedEvents(orderBy: "timestamp", orderDirection: "desc", limit: 5) {
    items {
      __typename
      timestamp
      landId
      production
    }
  }
}
```

#### Land-Specific Queries
```graphql
query GetLandActivity($landId: String!) {
  # Land ownership history
  landTransferEvents(where: { landId: $landId }, orderBy: "timestamp", orderDirection: "desc") {
    items {
      timestamp
      from
      to
    }
  }
  
  # Plant management
  plantLifetimeAssignedEvents(where: { landId: $landId }, orderBy: "timestamp", orderDirection: "desc") {
    items {
      timestamp
      plantId
      lifetime
      newLifetime
    }
  }
  
  # Production activities
  villageProductionClaimedEvents(where: { landId: $landId }, orderBy: "timestamp", orderDirection: "desc") {
    items {
      timestamp
      production
    }
  }
}
```

#### Cross-Game Player Activity
```graphql
query GetPlayerActivity($address: String!) {
  # Pixotchi activities
  attacks(where: { attacker: $address }, orderBy: "timestamp", orderDirection: "desc") {
    items {
      timestamp
      attackerName
      loserName
    }
  }
  
  # Land activities  
  landTransferEvents(where: { to: $address }, orderBy: "timestamp", orderDirection: "desc") {
    items {
      timestamp
      landId
    }
  }
}
```

#### Recent Attack Activity
```graphql
query GetRecentAttacks {
  attacks(orderBy: "timestamp", orderDirection: "desc", limit: 10) {
    items {
      id
      timestamp
      attackerName
      loserName
      scoresWon
    }
  }
}
```

#### Pixotchi-Specific Activity
```graphql
query GetPixotchiHistory($nftId: String!) {
  playeds(where: { nftId: $nftId }, orderBy: "timestamp", orderDirection: "desc") {
    items {
      timestamp
      gameName
      points
      timeExtension
    }
  }
}
```

### GraphQL Schema Exploration

Use [Apollo Sandbox](https://studio.apollographql.com/sandbox/explorer) with endpoint `https://api.mini.pixotchi.tech/graphql` for interactive schema exploration.


### For Existing Applications

#### Option 1: Use Our API Directly
```javascript
const response = await fetch('https://api.mini.pixotchi.tech/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `
      query GetUnifiedActivity {
        attacks(limit: 5, orderBy: "timestamp", orderDirection: "desc") {
          items { attackerName loserName timestamp }
        }
        landTransferEvents(limit: 5, orderBy: "timestamp", orderDirection: "desc") {
          items { landId from to timestamp }
        }
      }
    `
  })
});
```

#### Option 2: Deploy Your Own Instance
- Follow deployment instructions above
- Set up multiple RPC endpoints for reliability
- Customize for your specific contracts/events
- Point your frontend to your endpoint

### Network Support

#### Currently Supported
- **Base Mainnet** (Chain ID: 8453) - 4 RPC endpoints
- **Base Sepolia Testnet** (Chain ID: 84532) - 4 RPC endpoints

#### Adding New Networks
1. Update `ponder.config.ts` with new chain configuration
2. Add 4 network-specific RPC endpoints for redundancy
3. Update upgrade block constants in event handlers

## 🛠️ Development

### Prerequisites
- Node.js ≥18.14.0 (optimized for ≥24.1.0)
- PostgreSQL (for production) or PGlite (auto-installed for dev)
- Multiple RPC provider accounts (Infura, Alchemy, etc.)

### Local Setup
```bash
# Install dependencies
npm install

# Set up environment variables (see ENV_SETUP.md)
cp .env.example .env
# Edit .env with your RPC URLs

# Start development server
npm run dev

# Run type checking
npm run typecheck

# Lint code
npm run lint
```

### Project Structure
```
indexer/
├── abis/                    # Smart contract ABIs
│   ├── PixotchiRouterAbi.ts # Main Pixotchi contract interface
│   ├── LandAbi.ts          # Land contract interface
│   ├── Claimer_0x85bbAbi.ts # Rewards claiming
│   └── transformer.cjs      # ABI processing script
├── src/
│   ├── PixotchiNFT.ts      # Pixotchi event handlers w/ caching
│   ├── LandNFT.ts          # Land event handlers w/ caching
│   ├── Claimer.ts          # Rewards event handlers  
│   ├── PixotchiToken.ts    # Token event handlers
│   └── api/index.ts        # Custom API endpoints
├── ponder.config.ts        # Multi-RPC blockchain config
├── ponder.config.testnet.ts # Testnet configuration
├── ponder.schema.ts        # Unified database schema
├── ENV_SETUP.md           # Environment setup guide
└── guide.md               # Frontend integration guide
```

### Adding New Events

1. **Update Schema** (`ponder.schema.ts`):
```typescript
export const NewEvent = onchainTable("NewEvent", (t) => ({
  id: t.text().primaryKey(),
  // ... your fields
  timestamp: t.bigint().notNull(),
}));
```

2. **Add Event Handler** (appropriate `src/*.ts` file):
```typescript
ponder.on("ContractName:NewEvent", async ({ event, context }) => {
  await context.db.insert(NewEvent).values({
    id: event.id, // Use event.id for bundler compatibility
    timestamp: event.block.timestamp,
    // ... your data
  });
});
```

3. **Update Frontend Guide** (`guide.md`)

## Monitoring & Debugging

### Health Endpoints
- `/health` - Service health check
- `/ready` - Indexing readiness
- `/info` - Service information with contract addresses

### Performance Monitoring

The enhanced indexer provides detailed logging for monitoring both contracts:

```
INFO  sync       Started 'base' historical sync with 100% cached
INFO  app        Indexed 143 events across Pixotchi and Land contracts
INFO  indexing   Completed historical indexing
INFO  cache      Cleaned 15 expired entries from plant name cache. Cache size: 234
WARN  retry      getPlantName for NFT 1234 failed (attempt 1/4), retrying in 1200ms: Network timeout
INFO  land       Processing land transfer for landId 567
```

### Common Issues & Solutions

#### RPC Provider Failures
**Symptom**: `Failed getPlantName for NFT X after 3 retries`
**Cause**: All configured RPC endpoints are down/rate limited
**Solution**: 
- Add more RPC providers to environment variables
- Check provider API limits and billing
- Monitor provider status pages

#### Cache Memory Usage
**Symptom**: High memory consumption
**Cause**: Cache not cleaning up properly
**Solution**: Cache automatically cleans every 5 minutes, monitor logs for cleanup events

#### Duplicate Key Errors
**Symptom**: `duplicate key value violates unique constraint`
**Cause**: Transaction bundlers creating multiple events per transaction
**Solution**: Use `event.id` instead of `event.transaction.hash` (already implemented across all handlers)

#### Cross-Contract Event Conflicts
**Symptom**: Events not processing correctly when both contracts emit simultaneously
**Cause**: Resource contention or RPC rate limiting
**Solution**: 
- Verify all 4 RPC endpoints are properly configured
- Monitor cache hit rates in logs
- Consider upgrading RPC provider plans

#### Slow Syncing Performance
**Symptom**: Indexing taking longer than expected
**Cause**: RPC rate limiting or slow endpoints
**Solution**: 
- Verify all RPC endpoints are properly configured
- Monitor cache hit rates in logs
- Consider upgrading RPC provider plans

#### Schema Conflicts
**Symptom**: Migration errors on deployment
**Cause**: Schema changes without proper versioning
**Solution**: Use deployment-specific schemas (`--schema $RAILWAY_DEPLOYMENT_ID`)


## License

This project is private and proprietary to the Pixotchi team.

---

**Built with ❤️ for the Pixotchi community**
