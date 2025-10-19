import { createConfig } from "ponder";
import { http } from "viem";

import { PixotchiRouterAbi } from "./abis/PixotchiRouterAbi";
import { LandAbi } from "./abis/LandAbi";

export default createConfig({
  chains: {
    baseSepolia: {
      id: 84532,
      rpc: [
        // Primary RPC - Chainstack (may not support archive)
        process.env.PONDER_RPC_URL_TESTNET_1 || "https://base-sepolia.core.chainstack.com/7ec0d717d82dc95cf5cf7b5afbdd1f4c",
        // Secondary RPC - Infura (supports archive)
        process.env.PONDER_RPC_URL_TESTNET_2 || "https://base-sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
        // Tertiary RPC - Alchemy (supports archive)
        process.env.PONDER_RPC_URL_TESTNET_3 || "https://base-sepolia.alchemyapi.io/v2/demo",
        // Quaternary RPC - Public RPC (fallback)
        process.env.PONDER_RPC_URL_TESTNET_4 || "https://sepolia.base.org",
      ].filter(Boolean),
      transport: http(),
    },
  },
  contracts: {
    PixotchiNFT: {
      chain: "baseSepolia",
      abi: PixotchiRouterAbi,
      address: "0x1723a3F01895c207954d09F633a819c210d758c4",
      startBlock: 87976,
      maxBlockRange: 10000,
    },
    LandContract: {
      chain: "baseSepolia",
      abi: LandAbi,
      address: "0xBd4FB987Bcd42755a62dCf657a3022B8b17D5413",
      startBlock: 15709970,
      maxBlockRange: 10000,
    },
  },
});
