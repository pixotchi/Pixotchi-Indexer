import { ponder } from "ponder:registry";
import { 
  Land, 
  PlantLifetimeAssignedEvent, 
  PlantPointsAssignedEvent, 
  LandTransferEvent,
  VillageProductionClaimedEvent,
  VillageProductionXPClaimCooldownActiveEvent,
  VillageProductionXPClaimedEvent,
  VillageSpeedUpWithSeedEvent,
  VillageUpgradedWithLeafEvent,
  TownSpeedUpWithSeedEvent,
  TownUpgradedWithLeafEvent,
  QuestStartedEvent,
  QuestCommittedEvent,
  QuestFinalizedEvent,
  QuestResetEvent,
  WareHouseLifetimeAssignedEvent,
  WareHousePlantPointsAssignedEvent,
  LandNameChangedEvent,
  LandMintedEvent
} from "ponder:schema";
import type { IndexingFunctionArgs } from "ponder:env";

// Utility function to get owner of land NFT
async function getOwnerOf(
  client: any,
  LandContract: any,
  tokenId: bigint,
  blockNumber: bigint
) {
  const ownerOf = await client.readContract({
    abi: LandContract.abi,
    address: LandContract.address, 
    functionName: "ownerOf",
    args: [tokenId],
    blockNumber,
  });
  return ownerOf;
}

ponder.on("LandContract:LandMinted", async ({ event, context }: IndexingFunctionArgs<"LandContract:LandMinted">) => {
  await context.db
    .insert(Land)
    .values({
      id: event.args.tokenId,
      owner: event.args.to,
      blockHeight: event.block.number,
      timestamp: event.block.timestamp,
    });

  await context.db
    .insert(LandMintedEvent)
    .values({
      id: event.id,
      to: event.args.to,
      tokenId: event.args.tokenId,
      mintPrice: event.args.mintPrice,
      blockHeight: event.block.number,
      timestamp: event.block.timestamp,
    });
});

ponder.on("LandContract:Transfer", async ({ event, context }: IndexingFunctionArgs<"LandContract:Transfer">) => {
  await context.db
    .insert(Land)
    .values({
      id: event.args.value,
      owner: event.args.to,
      blockHeight: event.block.number,
      timestamp: event.block.timestamp,
    })
    .onConflictDoUpdate({
      owner: event.args.to,
      blockHeight: event.block.number,
      timestamp: event.block.timestamp,
    });

  await context.db
    .insert(LandTransferEvent)
    .values({
      id: event.id,
      from: event.args.from,
      to: event.args.to,
      tokenId: event.args.value,
      blockHeight: event.block.number,
      timestamp: event.block.timestamp,
    });
});

ponder.on("LandContract:LandNameChanged", async ({ event, context }: IndexingFunctionArgs<"LandContract:LandNameChanged">) => {
  const { client } = context;
  const { LandContract } = context.contracts;
  
  // Fetch the owner for the token
  const owner = await getOwnerOf(client, LandContract, event.args.tokenId, event.block.number);

  await context.db
    .insert(Land)
    .values({
      id: event.args.tokenId,
      owner: owner,
      name: event.args.name,
      blockHeight: event.block.number,
      timestamp: event.block.timestamp,
    })
    .onConflictDoUpdate({
      name: event.args.name,
      blockHeight: event.block.number,
      timestamp: event.block.timestamp,
    });

  await context.db
    .insert(LandNameChangedEvent)
    .values({
      id: event.id,
      tokenId: event.args.tokenId,
      name: event.args.name,
      blockHeight: event.block.number,
      timestamp: event.block.timestamp,
    });
});

ponder.on("LandContract:PlantLifetimeAssigned", async ({ event, context }: IndexingFunctionArgs<"LandContract:PlantLifetimeAssigned">) => {
  // Only track the event - don't maintain additional state to avoid race conditions
  await context.db
    .insert(PlantLifetimeAssignedEvent)
    .values({
      id: event.id,
      landId: event.args.landId,
      plantId: event.args.plantId,
      lifetime: event.args.lifetime,
      newLifetime: event.args.newLifetime,
      blockHeight: event.block.number,
      timestamp: event.block.timestamp,
    });
});

ponder.on("LandContract:PlantPointsAssigned", async ({ event, context }: IndexingFunctionArgs<"LandContract:PlantPointsAssigned">) => {
  // Only track the event - don't maintain additional state to avoid race conditions
  await context.db
    .insert(PlantPointsAssignedEvent)
    .values({
      id: event.id,
      landId: event.args.landId,
      plantId: event.args.plantId,
      addedPoints: event.args.addedPoints,
      newPlantPoints: event.args.newPlantPoints,
      blockHeight: event.block.number,
      timestamp: event.block.timestamp,
    });
});

ponder.on("LandContract:VillageProductionClaimed", async ({ event, context }: IndexingFunctionArgs<"LandContract:VillageProductionClaimed">) => {
  await context.db
    .insert(VillageProductionClaimedEvent)
    .values({
      id: event.id,
      landId: event.args.landId,
      buildingId: Number(event.args.buildingId),
      blockHeight: event.block.number,
      timestamp: event.block.timestamp,
    });
});

ponder.on("LandContract:VillageProductionXPClaimCooldownActive", async ({ event, context }: IndexingFunctionArgs<"LandContract:VillageProductionXPClaimCooldownActive">) => {
  await context.db
    .insert(VillageProductionXPClaimCooldownActiveEvent)
    .values({
      id: event.id,
      landId: event.args.landId,
      buildingId: event.args.buildingId,
      currentTime: event.args.currentTime,
      cooldownEndTime: event.args.cooldownEndTime,
      blockHeight: event.block.number,
      timestamp: event.block.timestamp,
    });
});

ponder.on("LandContract:VillageProductionXPClaimed", async ({ event, context }: IndexingFunctionArgs<"LandContract:VillageProductionXPClaimed">) => {
  await context.db
    .insert(VillageProductionXPClaimedEvent)
    .values({
      id: event.id,
      landId: event.args.landId,
      buildingId: event.args.buildingId,
      claimTime: event.args.claimTime,
      xpAwarded: event.args.xpAwarded,
      blockHeight: event.block.number,
      timestamp: event.block.timestamp,
    });
});

ponder.on("LandContract:VillageSpeedUpWithSeed", async ({ event, context }: IndexingFunctionArgs<"LandContract:VillageSpeedUpWithSeed">) => {
  await context.db
    .insert(VillageSpeedUpWithSeedEvent)
    .values({
      id: event.id,
      landId: event.args.landId,
      buildingId: Number(event.args.buildingId),
      speedUpCost: event.args.speedUpCost,
      xp: event.args.xp,
      blockHeight: event.block.number,
      timestamp: event.block.timestamp,
    });
});

ponder.on("LandContract:VillageUpgradedWithLeaf", async ({ event, context }: IndexingFunctionArgs<"LandContract:VillageUpgradedWithLeaf">) => {
  await context.db
    .insert(VillageUpgradedWithLeafEvent)
    .values({
      id: event.id,
      landId: event.args.landId,
      buildingId: Number(event.args.buildingId),
      upgradeCost: event.args.upgradeCost,
      xp: event.args.xp,
      blockHeight: event.block.number,
      timestamp: event.block.timestamp,
    });
});

ponder.on("LandContract:TownSpeedUpWithSeed", async ({ event, context }: IndexingFunctionArgs<"LandContract:TownSpeedUpWithSeed">) => {
  await context.db
    .insert(TownSpeedUpWithSeedEvent)
    .values({
      id: event.id,
      landId: event.args.landId,
      buildingId: Number(event.args.buildingId),
      speedUpCost: event.args.speedUpCost,
      xp: event.args.xp,
      blockHeight: event.block.number,
      timestamp: event.block.timestamp,
    });
});

ponder.on("LandContract:TownUpgradedWithLeaf", async ({ event, context }: IndexingFunctionArgs<"LandContract:TownUpgradedWithLeaf">) => {
  await context.db
    .insert(TownUpgradedWithLeafEvent)
    .values({
      id: event.id,
      landId: event.args.landId,
      buildingId: Number(event.args.buildingId),
      upgradeCost: event.args.upgradeCost,
      xp: event.args.xp,
      blockHeight: event.block.number,
      timestamp: event.block.timestamp,
    });
});

ponder.on("LandContract:QuestStarted", async ({ event, context }: IndexingFunctionArgs<"LandContract:QuestStarted">) => {
  await context.db
    .insert(QuestStartedEvent)
    .values({
      id: event.id,
      landId: event.args.landId,
      farmerSlotId: event.args.farmerSlotId,
      difficulty: Number(event.args.difficulty),
      startBlock: event.args.startBlock,
      endBlock: event.args.endBlock,
      blockHeight: event.block.number,
      timestamp: event.block.timestamp,
    });
});

ponder.on("LandContract:QuestCommitted", async ({ event, context }: IndexingFunctionArgs<"LandContract:QuestCommitted">) => {
  await context.db
    .insert(QuestCommittedEvent)
    .values({
      id: event.id,
      landId: event.args.landId,
      farmerSlotId: event.args.farmerSlotId,
      pseudoRndBlock: event.args.pseudoRndBlock,
      blockHeight: event.block.number,
      timestamp: event.block.timestamp,
    });
});

ponder.on("LandContract:QuestFinalized", async ({ event, context }: IndexingFunctionArgs<"LandContract:QuestFinalized">) => {
  await context.db
    .insert(QuestFinalizedEvent)
    .values({
      id: event.id,
      landId: event.args.landId,
      farmerSlotId: event.args.farmerSlotId,
      player: event.args.player,
      rewardType: Number(event.args.rewardType),
      amount: event.args.amount,
      blockHeight: event.block.number,
      timestamp: event.block.timestamp,
    });
});

ponder.on("LandContract:QuestReset", async ({ event, context }: IndexingFunctionArgs<"LandContract:QuestReset">) => {
  await context.db
    .insert(QuestResetEvent)
    .values({
      id: event.id,
      landId: event.args.landId,
      farmerSlotId: event.args.farmerSlotId,
      player: event.args.player,
      blockHeight: event.block.number,
      timestamp: event.block.timestamp,
    });
});

ponder.on("LandContract:WareHouseLifetimeAssigned", async ({ event, context }: IndexingFunctionArgs<"LandContract:WareHouseLifetimeAssigned">) => {
  await context.db
    .insert(WareHouseLifetimeAssignedEvent)
    .values({
      id: event.id,
      landId: event.args.landId,
      plantId: event.args.plantId,
      lifetime: event.args.lifetime,
      newLifetime: event.args.newLifetime,
      blockHeight: event.block.number,
      timestamp: event.block.timestamp,
    });
});

ponder.on("LandContract:WareHousePlantPointsAssigned", async ({ event, context }: IndexingFunctionArgs<"LandContract:WareHousePlantPointsAssigned">) => {
  await context.db
    .insert(WareHousePlantPointsAssignedEvent)
    .values({
      id: event.id,
      landId: event.args.landId,
      plantId: event.args.plantId,
      addedPoints: event.args.addedPoints,
      newPlantPoints: event.args.newPlantPoints,
      blockHeight: event.block.number,
      timestamp: event.block.timestamp,
    });
}); 