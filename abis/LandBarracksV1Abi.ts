export const LandBarracksV1Abi = [
  {
    type: "event",
    name: "BarracksBuilt",
    inputs: [
      {
        name: "landId",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "builder",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "token",
        type: "address",
        indexed: false,
        internalType: "address",
      },
      {
        name: "cost",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    outputs: [],
    anonymous: false,
  },
  {
    type: "event",
    name: "BarracksRaidResolved",
    inputs: [
      {
        name: "raidId",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "attackerLandId",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "defenderLandId",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "attackerWon",
        type: "bool",
        indexed: false,
        internalType: "bool",
      },
      {
        name: "troopsSent",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "attackerTroopsBefore",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "defenderTroopsBefore",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "attackerTroopsLost",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "defenderTroopsLost",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "survivingAttackers",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "survivingDefenders",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    outputs: [],
    anonymous: false,
  },
] as const;
