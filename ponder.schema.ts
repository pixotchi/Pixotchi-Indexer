import { onchainTable } from "ponder";

export const Attack = onchainTable("Attack", (t) => ({
  id: t.text().primaryKey(),
  attacker: t.bigint().notNull(),
  attackerName: t.text().notNull(),
  winner: t.bigint().notNull(),
  winnerName: t.text().notNull(),
  loser: t.bigint().notNull(),
  loserName: t.text().notNull(),
  scoresWon: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const ItemConsumed = onchainTable("ItemConsumed", (t) => ({
  id: t.text().primaryKey(),
  nftId: t.bigint().notNull(),
  nftName: t.text().notNull(),
  giver: t.text().notNull(),
  itemId: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const Killed = onchainTable("Killed", (t) => ({
  id: t.text().primaryKey(),
  nftId: t.bigint().notNull(),
  deadId: t.bigint().notNull(),
  loserName: t.text().notNull(),
  reward: t.bigint().notNull(),
  killer: t.text().notNull(),
  winnerName: t.text().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const Mint = onchainTable("Mint", (t) => ({
  id: t.text().primaryKey(),
  nftId: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const Played = onchainTable("Played", (t) => ({
  id: t.text().primaryKey(),
  nftId: t.bigint().notNull(),
  nftName: t.text().notNull(),
  points: t.bigint().notNull(),
  timeExtension: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
  gameName: t.text().notNull(),
}));

export const ShopItemPurchased = onchainTable("ShopItemPurchased", (t) => ({
  id: t.text().primaryKey(),
  nftId: t.bigint().notNull(),
  nftName: t.text().notNull(),
  giver: t.text().notNull(),
  itemId: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

// Land-related tables
export const Land = onchainTable("Land", (t) => ({
  id: t.bigint().primaryKey(),
  owner: t.text().notNull(),
  name: t.text(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const LandPlant = onchainTable("LandPlant", (t) => ({
  id: t.bigint().primaryKey(),
  landId: t.bigint().notNull(),
  lifetime: t.bigint().notNull(),
  points: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

// Land event tables
export const PlantLifetimeAssignedEvent = onchainTable("PlantLifetimeAssignedEvent", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  plantId: t.bigint().notNull(),
  lifetime: t.bigint().notNull(),
  newLifetime: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const PlantPointsAssignedEvent = onchainTable("PlantPointsAssignedEvent", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  plantId: t.bigint().notNull(),
  addedPoints: t.bigint().notNull(),
  newPlantPoints: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const LandTransferEvent = onchainTable("LandTransferEvent", (t) => ({
  id: t.text().primaryKey(),
  from: t.text().notNull(),
  to: t.text().notNull(),
  tokenId: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const VillageProductionClaimedEvent = onchainTable("VillageProductionClaimedEvent", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  buildingId: t.integer().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const VillageProductionXPClaimCooldownActiveEvent = onchainTable("VillageProductionXPClaimCooldownActiveEvent", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  buildingId: t.bigint().notNull(),
  currentTime: t.bigint().notNull(),
  cooldownEndTime: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const VillageProductionXPClaimedEvent = onchainTable("VillageProductionXPClaimedEvent", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  buildingId: t.bigint().notNull(),
  claimTime: t.bigint().notNull(),
  xpAwarded: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const VillageSpeedUpWithSeedEvent = onchainTable("VillageSpeedUpWithSeedEvent", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  buildingId: t.integer().notNull(),
  speedUpCost: t.bigint().notNull(),
  xp: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const VillageUpgradedWithLeafEvent = onchainTable("VillageUpgradedWithLeafEvent", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  buildingId: t.integer().notNull(),
  upgradeCost: t.bigint().notNull(),
  xp: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const TownSpeedUpWithSeedEvent = onchainTable("TownSpeedUpWithSeedEvent", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  buildingId: t.integer().notNull(),
  speedUpCost: t.bigint().notNull(),
  xp: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const TownUpgradedWithLeafEvent = onchainTable("TownUpgradedWithLeafEvent", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  buildingId: t.integer().notNull(),
  upgradeCost: t.bigint().notNull(),
  xp: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const QuestStartedEvent = onchainTable("QuestStartedEvent", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  farmerSlotId: t.bigint().notNull(),
  difficulty: t.integer().notNull(),
  startBlock: t.bigint().notNull(),
  endBlock: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const QuestCommittedEvent = onchainTable("QuestCommittedEvent", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  farmerSlotId: t.bigint().notNull(),
  pseudoRndBlock: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const QuestFinalizedEvent = onchainTable("QuestFinalizedEvent", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  farmerSlotId: t.bigint().notNull(),
  player: t.text().notNull(),
  rewardType: t.integer().notNull(),
  amount: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const QuestResetEvent = onchainTable("QuestResetEvent", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  farmerSlotId: t.bigint().notNull(),
  player: t.text().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const WareHouseLifetimeAssignedEvent = onchainTable("WareHouseLifetimeAssignedEvent", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  plantId: t.bigint().notNull(),
  lifetime: t.bigint().notNull(),
  newLifetime: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const WareHousePlantPointsAssignedEvent = onchainTable("WareHousePlantPointsAssignedEvent", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  plantId: t.bigint().notNull(),
  addedPoints: t.bigint().notNull(),
  newPlantPoints: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const LandNameChangedEvent = onchainTable("LandNameChangedEvent", (t) => ({
  id: t.text().primaryKey(),
  tokenId: t.bigint().notNull(),
  name: t.text().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const LandMintedEvent = onchainTable("LandMintedEvent", (t) => ({
  id: t.text().primaryKey(),
  to: t.text().notNull(),
  tokenId: t.bigint().notNull(),
  mintPrice: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));
