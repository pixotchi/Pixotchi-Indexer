import { createConfig } from "ponder";
import { http } from "viem";

import { PixotchiRouterAbi } from "./abis/PixotchiRouterAbi";
import { LandAbi } from "./abis/LandAbi";

export default createConfig({
  chains: {
    baseSepolia: {
      id: 84532,
      rpc: [
        // Primary RPC  
        process.env.PONDER_RPC_URL_TESTNET_1!,
        // Secondary RPC
        process.env.PONDER_RPC_URL_TESTNET_2!,
        // Tertiary RPC (fallback)
        process.env.PONDER_RPC_URL_TESTNET_3!,
        // Quaternary RPC (additional fallback)
        process.env.PONDER_RPC_URL_TESTNET_4!,
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
