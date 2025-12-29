import { ponder } from "ponder:registry";
import { Attack, ItemConsumed, Killed, Mint, Played, ShopItemPurchased } from "ponder:schema";
import type { IndexingFunctionArgs } from "ponder:env";

// Cache configuration
const PLANT_NAME_CACHE = new Map<string, { name: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

const UPGRADE_BLOCK_HIGH_1 = 15119426n; // Mainnet base
const UPGRADE_BLOCK_HIGH_1_TESTNET = 11004255n; // Sepolia

// Utility function for exponential backoff delay
function getRetryDelay(attempt: number): number {
    return INITIAL_RETRY_DELAY * Math.pow(2, attempt) + Math.random() * 1000;
}

// Utility function to get cache key
function getCacheKey(chainId: number, nftId: bigint): string {
    return `${chainId}:${nftId}`;
}

// Check if cache entry is valid
function isCacheValid(cacheEntry: { name: string; timestamp: number }): boolean {
    return Date.now() - cacheEntry.timestamp < CACHE_TTL;
}

// Enhanced retry wrapper for contract calls
async function withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = MAX_RETRIES,
    context: string = "contract call"
): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error as Error;

            if (attempt === maxRetries) {
                console.error(`Failed ${context} after ${maxRetries} retries:`, lastError.message);
                throw lastError;
            }

            const delay = getRetryDelay(attempt);
            console.warn(`${context} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, lastError.message);

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError!;
}

// Enhanced function to get a single plant name with caching and retry logic
async function getPlantName(
    chainId: number,
    eventBlockNumber: bigint,
    client: any,
    PixotchiNFT: any,
    input: bigint
): Promise<string> {
    const cacheKey = getCacheKey(chainId, input);
    const fallbackName = `Plant #${input}`;

    // Check cache first
    const cached = PLANT_NAME_CACHE.get(cacheKey);
    if (cached && isCacheValid(cached)) {
        return cached.name;
    }

    try {
        const upgradeBlockHigh = chainId === 8453 ? UPGRADE_BLOCK_HIGH_1 : UPGRADE_BLOCK_HIGH_1_TESTNET;

        // Return fallback for blocks before upgrade
        if (eventBlockNumber <= upgradeBlockHigh) {
            const result = fallbackName;
            // Cache the fallback result
            PLANT_NAME_CACHE.set(cacheKey, { name: result, timestamp: Date.now() });
            return result;
        }

        // Make contract call with retry logic
        const result = await withRetry(async () => {
            return await client.readContract({
                abi: PixotchiNFT.abi,
                address: PixotchiNFT.address,
                functionName: "getPlantName",
                args: [input],
                blockNumber: eventBlockNumber,
            });
        }, MAX_RETRIES, `getPlantName for NFT ${input}`);

        const plantName = (!result || result === "" || result === "0x") ? fallbackName : result;

        // Cache the successful result
        PLANT_NAME_CACHE.set(cacheKey, { name: plantName, timestamp: Date.now() });

        return plantName;

    } catch (error) {
        console.error(`Failed to get plant name for NFT ${input} after retries, using fallback:`, error);

        // Cache the fallback result to prevent repeated failures
        PLANT_NAME_CACHE.set(cacheKey, { name: fallbackName, timestamp: Date.now() });

        return fallbackName;
    }
}

// Enhanced function to get multiple plant names with batch optimization
async function getPlantsName(
    chainId: number,
    eventBlockNumber: bigint,
    client: any,
    PixotchiNFT: any,
    inputs: bigint[]
): Promise<string[]> {
    const upgradeBlockHigh = chainId === 8453 ? UPGRADE_BLOCK_HIGH_1 : UPGRADE_BLOCK_HIGH_1_TESTNET;

    // Return fallbacks for blocks before upgrade
    if (eventBlockNumber <= upgradeBlockHigh) {
        const results = inputs.map(input => `Plant #${input}`);
        // Cache all fallback results
        inputs.forEach((input, index) => {
            const cacheKey = getCacheKey(chainId, input);
            PLANT_NAME_CACHE.set(cacheKey, { name: results[index], timestamp: Date.now() });
        });
        return results;
    }

    const results: string[] = [];
    const uncachedInputs: { input: bigint; index: number }[] = [];

    // Check cache for each input
    for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const cacheKey = getCacheKey(chainId, input);
        const cached = PLANT_NAME_CACHE.get(cacheKey);

        if (cached && isCacheValid(cached)) {
            results[i] = cached.name;
        } else {
            uncachedInputs.push({ input, index: i });
            results[i] = `Plant #${input}`; // Set fallback initially
        }
    }

    // If all were cached, return early
    if (uncachedInputs.length === 0) {
        return results;
    }

    try {
        // Batch fetch uncached names with retry logic
        const contractCalls = uncachedInputs.map(({ input }) => ({
            abi: PixotchiNFT.abi,
            address: PixotchiNFT.address,
            functionName: 'getPlantName',
            args: [input],
        }));

        const output = await withRetry(async () => {
            return await client.multicall({
                contracts: contractCalls,
                blockNumber: eventBlockNumber,
            });
        }, MAX_RETRIES, `multicall for ${uncachedInputs.length} plant names`);

        // Process results and update cache
        output.forEach((obj: any, batchIndex: number) => {
            const uncachedItem = uncachedInputs[batchIndex];
            if (!uncachedItem) return;

            const { input, index } = uncachedItem;
            const cacheKey = getCacheKey(chainId, input);

            let plantName: string;
            if (obj.status === 'success' && obj.result && obj.result !== '' && obj.result !== '0x') {
                plantName = obj.result;
            } else {
                plantName = `Plant #${input}`;
            }

            results[index] = plantName;

            // Cache the result
            PLANT_NAME_CACHE.set(cacheKey, { name: plantName, timestamp: Date.now() });
        });

        return results;

    } catch (error) {
        console.error(`Failed to batch fetch plant names after retries, using fallbacks:`, error);

        // Cache fallback results for failed calls
        uncachedInputs.forEach(({ input, index }) => {
            const cacheKey = getCacheKey(chainId, input);
            const fallbackName = `Plant #${input}`;
            results[index] = fallbackName;
            PLANT_NAME_CACHE.set(cacheKey, { name: fallbackName, timestamp: Date.now() });
        });

        return results;
    }
}

// Periodic cache cleanup to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, value] of PLANT_NAME_CACHE.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            PLANT_NAME_CACHE.delete(key);
            cleanedCount++;
        }
    }

    if (cleanedCount > 0) {
        console.log(`Cleaned ${cleanedCount} expired entries from plant name cache. Cache size: ${PLANT_NAME_CACHE.size}`);
    }
}, CACHE_TTL); // Run cleanup every cache TTL period

ponder.on("PixotchiNFT:ItemConsumed", async ({ event, context }: IndexingFunctionArgs<"PixotchiNFT:ItemConsumed">) => {
    const { client } = context;
    const { PixotchiNFT } = context.contracts;
    const plantName = await getPlantName(context.chain.id, event.block.number, client, PixotchiNFT, event.args.nftId);

    await context.db
        .insert(ItemConsumed)
        .values({
            id: event.id,
            timestamp: event.block.timestamp,
            nftId: event.args.nftId,
            giver: event.args.giver,
            itemId: event.args.itemId,
            nftName: plantName,
        });
});

ponder.on("PixotchiNFT:ShopItemPurchased", async ({ event, context }: IndexingFunctionArgs<"PixotchiNFT:ShopItemPurchased">) => {
    const { client } = context;
    const { PixotchiNFT } = context.contracts;
    const plantName = await getPlantName(context.chain.id, event.block.number, client, PixotchiNFT, event.args.nftId);

    await context.db
        .insert(ShopItemPurchased)
        .values({
            id: event.id,
            timestamp: event.block.timestamp,
            nftId: event.args.nftId,
            giver: event.args.buyer,
            itemId: event.args.itemId,
            nftName: plantName,
        });
});



// ponder.on("PixotchiNFT:Pass", async ({ event, context }) => {
//   const { Pass } = context.db;
//
//   await Pass.create({
//     id: event.log.transactionHash,
//     data: {
//       timestamp: event.block.timestamp,
//       from: event.args.from,
//       to: event.args.to,
//     }
//   });
// });

ponder.on("PixotchiNFT:Mint", async ({ event, context }: IndexingFunctionArgs<"PixotchiNFT:Mint">) => {
    await context.db
        .insert(Mint)
        .values({
            id: event.id,
            timestamp: event.block.timestamp,
            nftId: event.args.id,
        });
});


ponder.on("PixotchiNFT:Played", async ({ event, context }: IndexingFunctionArgs<"PixotchiNFT:Played">) => {
    const { client } = context;
    const { PixotchiNFT } = context.contracts;
    const plantName = await getPlantName(context.chain.id, event.block.number, client, PixotchiNFT, event.args.id);

    await context.db
        .insert(Played)
        .values({
            id: event.id,
            timestamp: event.block.timestamp,
            nftId: event.args.id,
            points: event.args.points,
            timeExtension: event.args.timeExtension,
            nftName: plantName,
            gameName: event.args.gameName,
        });
});

ponder.on("PixotchiNFT:PlayedV2", async ({ event, context }: IndexingFunctionArgs<"PixotchiNFT:PlayedV2">) => {
    const { client } = context;
    const { PixotchiNFT } = context.contracts;
    const plantName = await getPlantName(context.chain.id, event.block.number, client, PixotchiNFT, event.args.id);

    await context.db
        .insert(Played)
        .values({
            id: event.id,
            timestamp: event.block.timestamp,
            nftId: event.args.id,
            points: event.args.points,
            timeExtension: event.args.timeExtension,
            nftName: plantName,
            gameName: event.args.gameName,
        });
});

ponder.on("PixotchiNFT:SpinGameV2Played", async ({ event, context }: IndexingFunctionArgs<"PixotchiNFT:SpinGameV2Played">) => {
    const { client } = context;
    const { PixotchiNFT } = context.contracts;
    const plantName = await getPlantName(context.chain.id, event.block.number, client, PixotchiNFT, event.args.nftId);

    await context.db
        .insert(Played)
        .values({
            id: event.id,
            timestamp: event.block.timestamp,
            nftId: event.args.nftId,
            points: event.args.pointsDelta,
            timeExtension: event.args.timeAdded,
            nftName: plantName,
            gameName: "SpinGameV2",
            player: event.args.player,
            rewardIndex: event.args.rewardIndex,
            timeAdded: event.args.timeAdded,
            leafAmount: event.args.leafAmount,
        })
        .onConflictDoUpdate({
            points: event.args.pointsDelta,
            timeExtension: event.args.timeAdded,
            nftName: plantName,
            timestamp: event.block.timestamp,
            player: event.args.player,
            rewardIndex: event.args.rewardIndex,
            timeAdded: event.args.timeAdded,
            leafAmount: event.args.leafAmount,
        });
});


// ponder.on("PixotchiNFT:RedeemRewards", async ({ event, context }) => {
//   const { RedeemRewards } = context.db;
//
//   await RedeemRewards.create({
//     id: event.log.transactionHash,
//     data: {
//       timestamp: event.block.timestamp,
//       nftId: event.args.id,
//       reward: event.args.reward,
//     }
//   });
// });


ponder.on("PixotchiNFT:Attack", async ({ event, context }: IndexingFunctionArgs<"PixotchiNFT:Attack">) => {
    const { client } = context;
    const { PixotchiNFT } = context.contracts;

    const plantNames = await getPlantsName(context.chain.id, event.block.number, client, PixotchiNFT, [event.args.attacker, event.args.winner, event.args.loser]);

    await context.db
        .insert(Attack)
        .values({
            id: event.id,
            timestamp: event.block.timestamp,
            attacker: event.args.attacker,
            winner: event.args.winner,
            loser: event.args.loser,
            scoresWon: event.args.scoresWon,
            attackerName: plantNames[0] || `Plant #${event.args.attacker}`,
            winnerName: plantNames[1] || `Plant #${event.args.winner}`,
            loserName: plantNames[2] || `Plant #${event.args.loser}`,
        });
});


ponder.on("PixotchiNFT:Killed", async ({ event, context }: IndexingFunctionArgs<"PixotchiNFT:Killed">) => {
    await context.db
        .insert(Killed)
        .values({
            id: event.id,
            timestamp: event.block.timestamp,
            winnerName: event.args.winnerName,
            nftId: event.args.nftId,
            deadId: event.args.deadId,
            killer: event.args.killer,
            loserName: event.args.loserName,
            reward: event.args.reward,
        });
});
