import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono, type Context, type Next } from "hono";
import { graphql } from "ponder";

const app = new Hono();
const graphqlHandler = graphql({ db, schema });
const isProduction = process.env.NODE_ENV === "production";
const sharedSecret = process.env.INDEXER_SHARED_SECRET?.trim() || "";
const maxRequestBytes = Number(process.env.INDEXER_MAX_REQUEST_BYTES || 32 * 1024);
const maxAliasCount = Number(process.env.INDEXER_MAX_ALIAS_COUNT || 10);
const maxOperationCount = Number(process.env.INDEXER_MAX_OPERATION_COUNT || 1);

function countGraphqlAliases(query: string): number {
  const matches = query.match(/(?:^|[\s{,])([A-Za-z_][\w]*)\s*:\s*[A-Za-z_][\w]*\s*(?=\()/g);
  return matches?.length ?? 0;
}

function countOperations(query: string): number {
  const matches = query.match(/\b(query|mutation|subscription)\b/g);
  return matches?.length || 1;
}

async function requireIndexerAccess(c: Context, next: Next) {
  if (!isProduction) {
    await next();
    return;
  }

  if (!sharedSecret) {
    return c.text("Indexer secret is not configured", 503);
  }

  if (c.req.header("x-indexer-secret") !== sharedSecret) {
    return c.notFound();
  }

  await next();
}

async function validateGraphqlRequest(c: Context, next: Next) {
  if (c.req.method !== "POST") {
    return c.notFound();
  }

  const contentLength = Number(c.req.header("content-length") || "0");
  if (contentLength > maxRequestBytes) {
    return c.text("Payload too large", 413);
  }

  const rawBody = await c.req.raw.clone().text();
  if (Buffer.byteLength(rawBody, "utf8") > maxRequestBytes) {
    return c.text("Payload too large", 413);
  }

  let payload: { query?: string } | null = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.text("Invalid JSON body", 400);
  }

  const query = typeof payload?.query === "string" ? payload.query : "";
  if (!query.trim()) {
    return c.text("Missing GraphQL query", 400);
  }

  if (isProduction && /\b__schema\b|\b__type\b/.test(query)) {
    return c.notFound();
  }

  if (countGraphqlAliases(query) > maxAliasCount) {
    return c.text("Too many GraphQL aliases", 400);
  }

  if (countOperations(query) > maxOperationCount) {
    return c.text("Too many GraphQL operations", 400);
  }

  await next();
}

if (!isProduction) {
  app.use("/", graphqlHandler);
}

app.use("/graphql", requireIndexerAccess, validateGraphqlRequest, graphqlHandler);

// Custom info endpoint (avoiding reserved routes)
app.get("/info", (c: Context) => {
  if (isProduction) {
    return c.notFound();
  }
  return c.json({ 
    name: "Unified Game Indexer",
    version: "2.0.0",
    status: "running", 
    timestamp: new Date().toISOString(),
    blockchain: "Base",
    contracts: {
      pixotchi: "0xeb4e16c804AE9275a655AbBc20cD0658A91F9235",
      land: "0x3f1F8F0C4BE4bCeB45E6597AFe0dE861B8c3278c"
    }
  });
});

// Basic API documentation
app.get("/api", (c: Context) => {
  if (isProduction) {
    return c.notFound();
  }
  return c.json({
    name: "Unified Game Indexer API",
    version: "2.0.0",
    endpoints: {
      graphql: "/graphql",
      info: "/info",
      health: "/health (internal)", // Note: handled by Ponder
      ready: "/ready (internal)",   // Note: handled by Ponder
      status: "/status (internal)"  // Note: handled by Ponder
    },
    tables: {
      pixotchi: ["Attack", "ItemConsumed", "Killed", "Mint", "Played", "ShopItemPurchased"],
      land: [
        "Land", 
        "PlantLifetimeAssignedEvent",
        "PlantPointsAssignedEvent", 
        "LandTransferEvent",
        "VillageProductionClaimedEvent",
        "VillageProductionXPClaimCooldownActiveEvent",
        "VillageProductionXPClaimedEvent",
        "VillageSpeedUpWithSeedEvent",
        "VillageUpgradedWithLeafEvent", 
        "TownSpeedUpWithSeedEvent",
        "TownUpgradedWithLeafEvent",
        "QuestStartedEvent",
        "QuestCommittedEvent", 
        "QuestFinalizedEvent",
        "QuestResetEvent",
        "WareHouseLifetimeAssignedEvent",
        "WareHousePlantPointsAssignedEvent",
        "LandNameChangedEvent",
        "LandMintedEvent"
      ]
    }
  });
});

if (isProduction) {
  app.all("/", (c: Context) => c.notFound());
}

export default app; 
