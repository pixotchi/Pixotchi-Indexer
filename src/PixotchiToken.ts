// import {ponder} from "@/generated";
//
// ponder.on("PixotchiToken:setup", async ({ event, context }) => {
//   console.log(event);
// });
//
//
// ponder.on("PixotchiToken:Transfer", async ({ event, context }) => {
//   //console.log(event.args);
//
//   await context.db.Wallet.upsert({
//     id: event.args.from,
//     create: {
//       spend: event.args.value,
//       fistUpdate: event.block.timestamp,
//       lastUpdate: event.block.timestamp
//     },
//     update: (wallet) => ({
//       spend: (wallet.current.spend + event.args.value),
//       lastUpdate: event.block.timestamp
//     })
//   });
//
//
// });
