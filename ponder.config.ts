import { createConfig } from "ponder";

import { PixotchiRouterAbi } from "./abis/PixotchiRouterAbi";
import { LandAbi } from "./abis/LandAbi";
import { LandCasinoV2Abi } from "./abis/LandCasinoV2Abi";

const landCasinoV2StartBlock = 42807354;

export default createConfig({
  chains: {
    base: {
      id: 8453,
      rpc: [
        // Primary RPC
        process.env.PONDER_RPC_URL_BASE_1!,
        // Secondary RPC
        process.env.PONDER_RPC_URL_BASE_2!,
        // Tertiary RPC (fallback)
        process.env.PONDER_RPC_URL_BASE_3!,
        // Quaternary RPC (additional fallback)
        process.env.PONDER_RPC_URL_BASE_4!,
      ].filter(Boolean),
    },
  },
  contracts: {
    PixotchiNFT: {
      chain: "base",
      abi: PixotchiRouterAbi,
      address: "0xeb4e16c804AE9275a655AbBc20cD0658A91F9235",
      startBlock: 33179676,
      maxBlockRange: 1000,
    },
    LandContract: {
      chain: "base",
      abi: LandAbi,
      address: "0x3f1F8F0C4BE4bCeB45E6597AFe0dE861B8c3278c",
      startBlock: 33179676,
      maxBlockRange: 1000,
    },
    // Post-upgrade multi-token casino/blackjack events.
    LandCasinoV2: {
      chain: "base",
      abi: LandCasinoV2Abi,
      address: "0x3f1F8F0C4BE4bCeB45E6597AFe0dE861B8c3278c",
      startBlock: landCasinoV2StartBlock,
      maxBlockRange: 1000,
    },
  },
});
