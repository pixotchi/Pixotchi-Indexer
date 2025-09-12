import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { graphql } from "ponder";

const app = new Hono();

// GraphQL endpoint
app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

// Custom info endpoint (avoiding reserved routes)
app.get("/info", (c) => {
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
app.get("/api", (c) => {
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
        "LandPlant", 
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

export default app; 