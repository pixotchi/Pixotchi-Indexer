// import { ponder } from "@/generated";
// import {bigint} from "@ponder/core/src/schema/columns";
//
// ponder.on("Claimer:AdminChanged", async ({ event, context }) => {
//   console.log(event.args);
// });
//
// ponder.on("Claimer:Upgraded", async ({ event, context }) => {
//   console.log(event.args);
// });
//
// ponder.on("Claimer:Claim", async ({ event, context }) => {
//   console.log(event.args);
//   const { WalletClaimed } = context.db;
//
//
//   // await WalletClaimed.create({
//   //   id: event.log.transactionHash),
//   //   data: {
//   //     lastUpdate: event.block.timestamp,
//   //     fistUpdate: event.block.timestamp,
//   //     interactionCounter: event.args.interactionCounter,
//   //     nonce: event.args.nonce,
//   //     claimedReferral: event.args.claimedReferral,
//   //     claimedAirdrop1: event.args.claimedAirdrop1,
//   //     claimedAmountReferral: event.args.claimedAmountReferral,
//   //   }
//   // });
//   //await WalletClaimed.findUnique()
//   const claimType = event.args.claimType;
//   const nonce = event.args.nonce;
//   let claimedAirdrop1 = bigint(0);
//   let claimedReferral = bigint(0);
//     if (claimType == "airdrop") {
//         claimedAirdrop1 = event.args.amount;
//     } else if (claimType == "referral") {
//         claimedReferral = event.args.amount;
//     }
//
//   await context.db.WalletClaimed.upsert({
//     id: event.args.wallet,
//     create: {
//       //claimedAirdrop1: claimType == "airdrop" ? 1 : 0,
//       //claimedReferral: claimType == "referral" ? 1 : 0,
//       claimedAirdrop1: claimedAirdrop1,
//       claimedReferral: claimedReferral,
//       nonce: nonce,
//       interactionCounter: 1,
//       claimedAmountReferral:
//
//       spend: event.args.value,
//       fistUpdate: event.block.timestamp,
//       lastUpdate: event.block.timestamp
//     },
//     update: (wallet) => ({
//       spend: (wallet.current.spend + event.args.value),
//       lastUpdate: event.block.timestamp
//     })
//   });
// });
//
// ponder.on("Claimer:EIP712DomainChanged", async ({ event, context }) => {
//   console.log(event.args);
// });
