import { createConfig } from "ponder";
import { http } from "viem";

import { PixotchiRouterAbi } from "./abis/PixotchiRouterAbi";
import { LandAbi } from "./abis/LandAbi";

export default createConfig({
  chains: {
    base: {
      id: 8453,
      rpc: [
        // Primary RPC - Chainstack (may not support archive)
        process.env.PONDER_RPC_URL_BASE_1 || "https://base-mainnet.core.chainstack.com/7ec0d717d82dc95cf5cf7b5afbdd1f4c",
        // Secondary RPC - Infura (supports archive)
        process.env.PONDER_RPC_URL_BASE_2 || "https://base-mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
        // Tertiary RPC - Alchemy (supports archive)
        process.env.PONDER_RPC_URL_BASE_3 || "https://base-mainnet.alchemyapi.io/v2/demo",
        // Quaternary RPC - Public RPC (fallback)
        process.env.PONDER_RPC_URL_BASE_4 || "https://mainnet.base.org",
      ].filter(Boolean),
      transport: http(),
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
  },
});
