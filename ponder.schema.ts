import { onchainTable } from "ponder";

export const Attack = onchainTable("attack", (t) => ({
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

export const ItemConsumed = onchainTable("item_consumed", (t) => ({
  id: t.text().primaryKey(),
  nftId: t.bigint().notNull(),
  nftName: t.text().notNull(),
  giver: t.text().notNull(),
  itemId: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const Killed = onchainTable("killed", (t) => ({
  id: t.text().primaryKey(),
  nftId: t.bigint().notNull(),
  deadId: t.bigint().notNull(),
  loserName: t.text().notNull(),
  reward: t.bigint().notNull(),
  killer: t.text().notNull(),
  winnerName: t.text().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const Mint = onchainTable("mint", (t) => ({
  id: t.text().primaryKey(),
  nftId: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const Played = onchainTable("played", (t) => ({
  id: t.text().primaryKey(),
  nftId: t.bigint().notNull(),
  nftName: t.text().notNull(),
  points: t.bigint().notNull(),
  timeExtension: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
  gameName: t.text().notNull(),
  player: t.text(),
  rewardIndex: t.bigint(),
  timeAdded: t.bigint(),
  leafAmount: t.bigint(),
}));

export const ShopItemPurchased = onchainTable("shop_item_purchased", (t) => ({
  id: t.text().primaryKey(),
  nftId: t.bigint().notNull(),
  nftName: t.text().notNull(),
  giver: t.text().notNull(),
  itemId: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

// Land-related tables
export const Land = onchainTable("land", (t) => ({
  id: t.bigint().primaryKey(),
  owner: t.text().notNull(),
  name: t.text(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

// Land event tables
export const PlantLifetimeAssignedEvent = onchainTable("plant_lifetime_assigned_event", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  plantId: t.bigint().notNull(),
  lifetime: t.bigint().notNull(),
  newLifetime: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const PlantPointsAssignedEvent = onchainTable("plant_points_assigned_event", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  plantId: t.bigint().notNull(),
  addedPoints: t.bigint().notNull(),
  newPlantPoints: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const LandTransferEvent = onchainTable("land_transfer_event", (t) => ({
  id: t.text().primaryKey(),
  from: t.text().notNull(),
  to: t.text().notNull(),
  tokenId: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const VillageProductionClaimedEvent = onchainTable("village_production_claimed_event", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  buildingId: t.integer().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const VillageProductionXPClaimCooldownActiveEvent = onchainTable("village_production_xp_claim_cooldown_active_event", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  buildingId: t.bigint().notNull(),
  currentTime: t.bigint().notNull(),
  cooldownEndTime: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const VillageProductionXPClaimedEvent = onchainTable("village_production_xp_claimed_event", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  buildingId: t.bigint().notNull(),
  claimTime: t.bigint().notNull(),
  xpAwarded: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const VillageSpeedUpWithSeedEvent = onchainTable("village_speed_up_with_seed_event", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  buildingId: t.integer().notNull(),
  speedUpCost: t.bigint().notNull(),
  xp: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const VillageUpgradedWithLeafEvent = onchainTable("village_upgraded_with_leaf_event", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  buildingId: t.integer().notNull(),
  upgradeCost: t.bigint().notNull(),
  xp: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const TownSpeedUpWithSeedEvent = onchainTable("town_speed_up_with_seed_event", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  buildingId: t.integer().notNull(),
  speedUpCost: t.bigint().notNull(),
  xp: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const TownUpgradedWithLeafEvent = onchainTable("town_upgraded_with_leaf_event", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  buildingId: t.integer().notNull(),
  upgradeCost: t.bigint().notNull(),
  xp: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const QuestStartedEvent = onchainTable("quest_started_event", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  farmerSlotId: t.bigint().notNull(),
  difficulty: t.integer().notNull(),
  startBlock: t.bigint().notNull(),
  endBlock: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const QuestCommittedEvent = onchainTable("quest_committed_event", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  farmerSlotId: t.bigint().notNull(),
  pseudoRndBlock: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const QuestFinalizedEvent = onchainTable("quest_finalized_event", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  farmerSlotId: t.bigint().notNull(),
  player: t.text().notNull(),
  rewardType: t.integer().notNull(),
  amount: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const QuestResetEvent = onchainTable("quest_reset_event", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  farmerSlotId: t.bigint().notNull(),
  player: t.text().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const WareHouseLifetimeAssignedEvent = onchainTable("warehouse_lifetime_assigned_event", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  plantId: t.bigint().notNull(),
  lifetime: t.bigint().notNull(),
  newLifetime: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const WareHousePlantPointsAssignedEvent = onchainTable("warehouse_plant_points_assigned_event", (t) => ({
  id: t.text().primaryKey(),
  landId: t.bigint().notNull(),
  plantId: t.bigint().notNull(),
  addedPoints: t.bigint().notNull(),
  newPlantPoints: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const LandNameChangedEvent = onchainTable("land_name_changed_event", (t) => ({
  id: t.text().primaryKey(),
  tokenId: t.bigint().notNull(),
  name: t.text().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const LandMintedEvent = onchainTable("land_minted_event", (t) => ({
  id: t.text().primaryKey(),
  to: t.text().notNull(),
  tokenId: t.bigint().notNull(),
  mintPrice: t.bigint().notNull(),
  blockHeight: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));
