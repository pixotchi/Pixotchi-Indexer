# Get started [An introduction to Ponder]

## What is Ponder?

Ponder is an open-source framework for custom Ethereum indexing.

You write TypeScript code to transform onchain data into your application's schema. Then, Ponder fetches data from the chain, runs your indexing logic, and writes the result to Postgres.

Once indexed, you can query the data through GraphQL, SQL over HTTP, or directly in Postgres.

## Quickstart

::::steps

### Run `create-ponder`

The quickest way to create a new Ponder project is `create-ponder`, which sets up everything automatically for you.

:::code-group

```bash [pnpm]
pnpm create ponder
```

```bash [yarn]
yarn create ponder
```

```bash [npm]
npm init ponder@latest
```

:::

On installation, you'll see a few prompts.

:::code-group

```ansi [Default]
✔ What's the name of your project? › new-project
✔ Which template would you like to use? › Default

✔ Installed packages with pnpm.
✔ Initialized git repository.
```

```ansi [ERC-20 example]
✔ What's the name of your project? › new-project
✔ Which template would you like to use? › Reference - ERC20 token

✔ Installed packages with pnpm.
✔ Initialized git repository.
```

```ansi [Etherscan template]
✔ What's the name of your project? › new-project
✔ Which template would you like to use? › Etherscan contract link
✔ Enter a block explorer contract url › https://basescan.org/address/0x3bf93770f2d4a794c3d9ebefbaebae2a8f09a5e5

✔ Fetched contract metadata from basescan.org.
✔ Installed packages with pnpm.
✔ Initialized git repository.
```

```ansi [Subgraph template]
✔ What's the name of your project? › new-project
✔ Which template would you like to use? › Subgraph ID
✔ Which provider is the subgraph deployed to? › The Graph
✔ Enter a subgraph Deployment ID › QmWSfh5qnidd1tBd6FY6eDvbSQUPTNhNG7o8CUGenvbaht

✔ Fetched subgraph metadata for QmWSfh5qnidd1tBd6FY6eDvbSQUPTNhNG7o8CUGenvbaht.
✔ Installed packages with pnpm.
✔ Initialized git repository.
```

:::

This guide follows the ERC-20 example, which indexes a token contract on Ethereum mainnet.

### Start the dev server

After installation, start the local development server.

:::code-group

```bash [pnpm]
pnpm dev
```

```bash [yarn]
yarn dev
```

```bash [npm]
npm run dev
```

:::

Ponder will connect to the database, start the HTTP server, and begin indexing.

:::code-group

```ansi [Logs]
12:16:42.845 INFO  Connected to database type=postgres database=localhost:5432/demo (35ms)
12:16:42.934 INFO  Connected to JSON-RPC chain=mainnet hostnames=["eth-mainnet.g.alchemy.com"] (85ms)
12:16:43.199 INFO  Created database tables count=4 tables=["account","transfer_event","allowance","approval_event"] (17ms)
12:16:43.324 INFO  Created HTTP server port=42069 (5ms)
12:16:43.325 INFO  Started returning 200 responses endpoint=/health
12:16:43.553 INFO  Started backfill indexing chain=mainnet block_range=[13142655,13150000]
12:16:43.555 INFO  Started fetching backfill JSON-RPC data chain=mainnet cached_block=13145448 cache_rate=38.0%
12:16:43.796 INFO  Indexed block range chain=mainnet event_count=4259 block_range=[13142655,13145448] (164ms)
12:16:43.840 INFO  Indexed block range chain=mainnet event_count=33 block_range=[13145449,13145474] (4ms)
```

```ansi [Terminal UI]
Chains

│ Chain   │ Status   │ Block    │ RPC (req/s) │
├─────────┼──────────┼──────────┼─────────────┤
│ mainnet │ backfill │ 13145260 │        27.5 │

Indexing (backfill)

│ Event          │ Count │ Duration (ms) │
├────────────────┼───────┼───────────────┤
│ ERC20:Transfer │  3345 │         0.015 │
│ ERC20:Approval │   384 │         0.011 │

████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 35.1% (1m 22s eta)

API endpoints
Live at http://localhost:42069
```

:::

### Query the database

Visit [localhost:42069/graphql](http://localhost:42069/graphql) in your browser to explore the auto-generated GraphQL API. Here's a query for the top accounts by balance, along with the total number of accounts.

:::code-group

```graphql [Query]
query {
  accounts(orderBy: "balance", orderDirection: "desc", limit: 2) {
    items {
      address
      balance
    }
    totalCount
  }
}
```

```json [Result]
{
  "accounts": {
    "items": [
      { "address": "0x1234567890123456789012345678901234567890", "balance": "1000000000000000000" },
      { "address": "0x1234567890123456789012345678901234567891", "balance": "900000000000000000" },
    ],
    "totalCount": 1726,
  }
}
```

:::

:::tip
You can also query Ponder tables directly in Postgres, or write custom API endpoints. [Read more](/docs/query/direct-sql).
:::

### Customize the schema

Let's add a new column to a table in `ponder.schema.ts`. We want to track which accounts are an owner of the token contract.

```ts [ponder.schema.ts]
import { index, onchainTable, primaryKey, relations } from "ponder";

export const account = onchainTable("account", (t) => ({
  address: t.hex().primaryKey(),
  balance: t.bigint().notNull(),
  isOwner: t.boolean().notNull(), // [!code ++]
}));

// ...
```

Immediately, there's a type error in `src/index.ts` and a runtime error in the terminal. We added a required column, but our indexing logic doesn't include it.

```ansi [Terminal]
12:16:16 PM ERROR indexing   Error while processing 'ERC20:Transfer' event
NotNullConstraintError: Column 'account.isOwner' violates not-null constraint.
    at /workspace/new-project/src/index.ts:10:3
   8 |
   9 | ponder.on("ERC20:Transfer", async ({ event, context }) => {
> 10 |   await context.db
     |   ^
  11 |     .insert(account)
  12 |     .values({ address: event.args.from, balance: 0n })
  13 |     .onConflictDoUpdate((row) => ({
```

### Update indexing logic

Update the indexing logic to include `isOwner` when inserting new rows into the `account` table.

```ts [src/index.ts]
import { ponder } from "ponder:registry";
import { account } from "ponder:schema";

const OWNER_ADDRESS = "0x3bf93770f2d4a794c3d9ebefbaebae2a8f09a5e5"; // [!code ++]

ponder.on("ERC20:Transfer", async ({ event, context }) => {
  await context.db
    .insert(account)
    .values({
      address: event.args.from,
      balance: 0n,
      isOwner: event.args.from === OWNER_ADDRESS, // [!code ++]
    })
    .onConflictDoUpdate((row) => ({
    // ...
})
```

As soon as we save the file, the dev server hot reloads and finishes indexing successfully.

:::code-group

```ansi [Logs]
12:19:31.629 INFO  Hot reload "src/index.ts"
12:19:31.889 WARN  Dropped existing database tables count=4 tables=["account","transfer_event","allowance","approval_event"] (3ms)
12:19:31.901 INFO  Created database tables count=4 tables=["account","transfer_event","allowance","approval_event"] (12ms)
12:19:32.168 INFO  Started backfill indexing chain=mainnet block_range=[13142655,13150000]
12:19:32.169 INFO  Started fetching backfill JSON-RPC data chain=mainnet cached_block=13147325 cache_rate=63.6%
12:19:32.447 INFO  Indexed block range chain=mainnet event_count=6004 block_range=[13142655,13146396] (199ms)
12:19:32.551 INFO  Indexed block range chain=mainnet event_count=3607 block_range=[13146397,13147325] (104ms)
```

```ansi [Terminal UI]
Chains

│ Chain   │ Status   │ Block    │ RPC (req/s) │
├─────────┼──────────┼──────────┼─────────────┤
│ mainnet │ backfill │ 13146425 │        25.2 │

Indexing (backfill)

│ Event          │ Count │ Duration (ms) │
├────────────────┼───────┼───────────────┤
│ ERC20:Transfer │  5155 │         0.014 │
│ ERC20:Approval │   938 │         0.010 │

████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░ 51.5% (1m 07s eta)

API endpoints
Live at http://localhost:42069
```

:::

::::

## Next steps

This quickstart only scratches the surface of what Ponder can do. Take a look at the [examples directory](https://github.com/ponder-sh/ponder/tree/main/examples) for more complex projects, or the [GitHub dependents](https://github.com/ponder-sh/ponder/network/dependents?package_id=UGFja2FnZS0xMzA2OTEyMw%3D%3D) for a list of real-world repositories using Ponder.

Or, continue reading the guides and API reference here on the documentation site.

- [Contract configuration](/docs/config/contracts)
- [Query the database directly](/docs/query/direct-sql)
- [Schema design](/docs/schema/tables)
# Requirements [Get Ponder running on your machine]

The `create-ponder` CLI is the easiest way to [get started](/docs/get-started) with Ponder. If it runs without error, your system likely meets the requirements.

## System requirements

- macOS, Linux, or Windows (including WSL).
- [Node.js](https://nodejs.org/en) 18.18 or later.
- [PostgreSQL](https://www.postgresql.org/download/) version 14, 15, 16 or 17.

## TypeScript

Ponder uses advanced TypeScript features to offer end-to-end type safety without code generation. We **strongly** recommend taking the time to set up a working TypeScript development environment – it will pay dividends in the long run.

### Requirements

- TypeScript `>=5.0.4`, viem `>=2`, and hono `>=4.5`
- ABIs must be asserted `as const` following [ABIType guidelines](https://abitype.dev/guide/getting-started#usage)
- The `ponder-env.d.ts` file must be present and up to date

### `ponder-env.d.ts`

This file powers Ponder's zero-codegen type system. It contains a declaration for the `ponder:registry` virtual module which exports types derived from `ponder.config.ts` and `ponder.schema.ts`.

After upgrading to a new version of `ponder`, the dev server might make changes to `ponder-env.d.ts`. When this happens, please accept and commit the changes.

### VSCode

By default, VSCode's TypeScript language features use an internal version of TypeScript. Sometimes, this version does not meet Ponder's requirement of `>=5.0.4`.

To change VSCode's TypeScript version, run `TypeScript: Select TypeScript version..."` from the command palette and select `Use Workspace Version` or [update VSCode's version](https://stackoverflow.com/questions/39668731/what-typescript-version-is-visual-studio-code-using-how-to-update-it).
# Database [Set up the database]

Ponder supports two database options, [**PGlite**](https://pglite.dev/) and Postgres.

- **PGlite**: An embedded Postgres database. PGlite runs in the same Node.js process as Ponder, and stores data in the `.ponder` directory. **Only suitable for local development**.
- **PostgreSQL**: A traditional Postgres database server. Required for production, can be used for local development.

## Choose a database

Ponder uses PGlite by default. To use Postgres, set the `DATABASE_URL` environment variable to a Postgres connection string, or use explicit configuration in `ponder.config.ts`.

```ts
import { createConfig } from "ponder";

export default createConfig({
  database: { // [!code focus]
    kind: "postgres", // [!code focus]
    connectionString: "postgresql://user:password@localhost:5432/dbname", // [!code focus]
  }, // [!code focus]
  // ...
});
```

[Read more](/docs/api-reference/ponder/config#database) about database configuration in the `ponder.config.ts` API reference.

## Database schema

Ponder uses **database schemas** to organize data. Each instance must use a different schema.

Use the `DATABASE_SCHEMA` environment variable or `--schema` CLI option to configure the database schema for an instance. This is where the app will create the tables defined in `ponder.schema.ts`.

:::code-group

```bash [.env.local]
DATABASE_SCHEMA=my_schema
```

```bash [CLI]
ponder start --schema my_schema
```

:::

[Read more](/docs/production/self-hosting#database-schema) about database schema selection in the self-hosting guide.

### Guidelines

Here are a few things to keep in mind when choosing a database schema.

- No two Ponder instances/deployments can use the same database schema at the same time.
- Tables created by `ponder start` are treated as valuable and will never be dropped automatically.
- The default schema for `ponder dev` is `public`. There is no default for `ponder start`, you must explicitly set the database schema.
- Use `ponder dev` for local development; `ponder start` is intended for production.
# Migration guide [Upgrade to a new version of Ponder]

## 0.14

### Breaking changes

#### Metrics updates

* Removed the `ponder_historical_duration`, `ponder_indexing_has_error`, and `ponder_http_server_port` metrics.
* Added a `chain` label to `ponder_historical_start_timestamp_seconds` and `ponder_historical_end_timestamp_seconds`.
* Updated histogram bucket limits.

### New features

#### Log output improvements

Ponder now emits a more useful set of logs. These changes improve signal-to-noise and aim to eliminate scenarios where Ponder appears to hang without printing any logs.

Highlights:
* Pretty logs (the default) now use millisecond precision for timestamps, no longer include a "service" column, and use [logfmt](https://brandur.org/logfmt) formatting for extra properties.
* JSON-formatted logs (`--log-format json` CLI option) now include a wider range of properties, e.g. `duration`, `block_range`, `chain_id`, and so on. The standard `service` property was removed.

![New log output screenshot](/logs-014.png)

#### GraphQL offset pagination

The GraphQL now supports `offset` pagination for each plural query field and `many()` relationship field.

[Read more](/docs/query/graphql#pagination) in the GraphQL pagination docs.

#### Custom database views

Ponder now supports custom database views in `ponder.schema.ts` that reference other tables or views in your schema. Custom views are defined using the Drizzle query builder API.

We expect this feature to be particularly useful for users who want custom query-time transformation logic but still prefer GraphQL (vs. SQL-over-HTTP or direct SQL).

[Read more](/docs/schema/views) in the custom view guide.

## 0.13

### Breaking changes

None.

### New features

#### Performance

Ponder now queries less data from the database when reindexing against a full RPC cache. This can eliminate a significant amount of unnecessary work for apps with a large number of events where the indexing logic only accesses a few properties on the `event` object.

## 0.12

### Breaking changes

#### Lowercase addresses

Address values on the `event` object are now always **lowercase**. Before, these values were always checksum encoded.

This includes decoded event and trace arguments (e.g. `event.args.sender`) and these standard properties of the `event` object:
- `event.block.miner`
- `event.log.address`
- `event.transaction.to`
- `event.transaction.from`
- `event.transactionReceipt.from`
- `event.transactionReceipt.to`
- `event.transactionReceipt.contractAddress`
- `event.trace.from`
- `event.trace.to`

### New features

#### Exit code 75

Ponder now exits with code 75 when the instance encounters a retryable error. This includes most RPC errors and database connection issues.

Exit code 1 now indicates a fatal error that is unlikely to resolve after a restart. This includes logical indexing errors (e.g. unique constraint violations).

## 0.11

### Breaking changes

#### Renamed `networks` → `chains`

The `networks` field in `ponder.config.ts` was renamed and redesigned.

- `networks` → `chains`
- `chainId` → `id`
- `transport` → `rpc`

The new `rpc` field accepts one or more RPC endpoints directly, or a Viem Transport for backwards compatibility. When multiple RPC URLS are provided, Ponder load balances across them.

```ts [ponder.config.ts]
import { createConfig } from "ponder";
import { http } from "viem";

export default createConfig({
  networks: { // [!code --]
    mainnet: { // [!code --]
      chainId: 1, // [!code --]
      transport: http("https://eth-mainnet.g.alchemy.com/v2/your-api-key"), // [!code --]
    }, // [!code --]
  }, // [!code --]
  chains: { // [!code ++]
    mainnet: { // [!code ++]
      id: 1, // [!code ++]
      rpc: "https://eth-mainnet.g.alchemy.com/v2/your-api-key", // [!code ++]
    }, // [!code ++]
  }, // [!code ++]
  contracts: {
    Erc20: {
      network: "mainnet", // [!code --]
      chain: "mainnet", // [!code ++]
      // ...
    }
  }
});
```

#### Renamed `context.network` → `context.chain`

The indexing function context object `context.network` was renamed to `context.chain`.

#### Renamed API functions → API endpoints

**API functions** were renamed to **API endpoints** throughout the documentation.

#### `publicClients` now keyed by chain name

The [`publicClients`](/docs/query/api-endpoints#rpc-requests) object (available in API endpoints) is now keyed by chain name, not chain ID.

#### `/status` response type

The response type for the `/status` endpoint and related functions from `@ponder/client` and `@ponder/react` has changed.

```ts
type Status = {
  [chainName: string]: {
    ready: boolean; // [!code --]
    id: number; // [!code ++]
    block: { number: number; timestamp: number };
  };
};
```

#### Default `multichain` ordering

The default event ordering strategy was changed from `omnichain` to `multichain`. [Read more](/docs/api-reference/ponder/config#ordering) about event ordering.

### New features

#### Database views pattern

This release introduces a new pattern for querying Ponder tables directly in Postgres. [Read more](/docs/production/self-hosting#views-pattern) about the views pattern.

:::steps

##### Update start command

To enable the views pattern on platforms like Railway, update the start command to include the new `--views-schema` flag.

```bash [Start command]
pnpm start --schema $RAILWAY_DEPLOYMENT_ID # [!code --]
pnpm start --schema $RAILWAY_DEPLOYMENT_ID --views-schema my_project # [!code ++]
```

Whenever a deployment becomes *ready* (historical indexing finishes), it will create views in the specified schema that "point" to its tables.

##### Query views schema

With this configuration, downstream applications can query the views schema directly. The views will always point at the latest deployment's tables.

```sql
SELECT * FROM my_project.accounts;
```

:::


## 0.10

### Breaking changes

#### `ponder_sync` database migration

**WARNING**: This release includes an irreversible database migration to the RPC request cache located in the `ponder_sync` schema. Here are some details to consider when upgrading your production environment.

1. When an `0.10` instance starts up, it will attempt to run the migration against the connected database.
2. Any `<=0.9` instances currently connected to the database will crash, or the migration will fail.
3. Once the migration is complete, it's not possible to run `<=0.9` instances against the upgraded database.

#### Removed `event.log.id`

The `event.log.id` and `event.trace.id` properties were removed. Replace each occurrence with the new `event.id` property (described below), or update the table definition to use a compound primary key that better represents the business logic / domain.

```ts [src/index.ts]
import { ponder } from "ponder:registry";
import { transferEvent } from "ponder:registry";

ponder.on("ERC20:Transfer", ({ event, context }) => {
  await context.db
    .insert(transferEvent)
    .values({ id: event.log.id }); // [!code --]
    .values({ id: event.id }); // [!code ++]
});
```

#### Removed `event.name`

The undocumented `event.name` property was also removed.

### New features

#### `event.id`

The new `event.id` property is a globally unique identifier for a log, block, transaction, or trace event that works across any number of chains. Each `event.id` value is a 75-digit positive integer represented as a string.

#### Factory performance

This release fixes a long-standing performance issue affecting large factory contracts (10k+ addresses). Before, a SQL query was used to dynamically generate the list of addresses for each batch of events. This did not scale well. Now, the list of addresses is materialized directly and all address filtering occurs in-memory.

#### RPC request cache fixes

This release fixes two performance issues related to the ad-hoc RPC request cache.

1. **Reorg reconciliation** — Before, the query that evicted non-canonical results from the cache did not have an appropriate index. This occasionally caused timeouts leading to a crash.
2. **Large multicalls** — Before, multicall requests were treated naively as a single large `eth_call`. Now, the caching logic intelligently splits large multicall requests into smaller chunks.

## 0.9

### Breaking changes

#### API endpoints file is required

The Hono / API endpoints file `src/api/index.ts` is now required. The GraphQL API is no longer served by default.

To achieve the same functionality as `<=0.8`, copy the following code into `src/api/index.ts`.

```ts [src/api/index.ts]
import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { graphql } from "ponder";

const app = new Hono();

app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

export default app;
```

#### Removed `ponder.get()`, `post()`, `use()`

This release makes custom API endpoints less opinionated. Just default export a normal Hono `App` object from the `src/api/index.ts` file, and Ponder will serve it.

The `ponder.get()`, `post()`, `use()` methods were removed. Now, use Hono's built-in routing system.

:::code-group
```ts [src/api/index.ts (0.8 and below)]
import { ponder } from "ponder:registry";

ponder.get("/hello", (c) => {
  return c.text("Hello, world!");
});
```

```ts [src/api/index.ts (0.9)]
import { Hono } from "hono";

const app = new Hono();

app.get("/hello", (c) => {
  return c.text("Hello, world!");
});

export default app;
```

:::

#### Removed `c.db`

The `c.db` object was removed from the Hono context. Now, use the `"ponder:api"` virtual module to access the readonly Drizzle database object.

```ts [src/api/index.ts]
import { db } from "ponder:api"; // [!code focus]
import schema from "ponder:schema";
import { Hono } from "hono";

const app = new Hono();

app.get("/account/:address", async (c) => {
  const address = c.req.param("address");

  const account = await db // [!code focus]
    .select() // [!code focus]
    .from(schema.accounts) // [!code focus]
    .where(eq(schema.accounts.address, address)) // [!code focus]
    .limit(1); // [!code focus]

  return c.json(account);
});

export default app;
```

### New features

#### SQL over HTTP

The `@ponder/client` package provides a new experience for querying a Ponder app over HTTP. It's an SQL-based alternative to the GraphQL API. [Read more](/docs/query/sql-over-http).

#### `@ponder/react`

The `@ponder/react` package uses `@ponder/client` and Tanstack Query to provide reactive live queries. [Read more](/docs/query/sql-over-http#guide-react).

#### `publicClients`

Custom API endpoint files now have access to a new `"ponder:api"` virtual module. This module contains the `db` object and a new `publicClients` object, which contains a Viem [Public Client](https://viem.sh/docs/clients/public) for each network. These clients use the transports defined in `ponder.config.ts`.

```ts [src/api/index.ts] {1,11}
import { publicClients, db } from "ponder:api"; // [!code focus]
import schema from "ponder:schema";
import { Hono } from "hono";

const app = new Hono();

app.get("/account/:chainId/:address", async (c) => {
  const chainId = c.req.param("chainId");
  const address = c.req.param("address");

  const balance = await publicClients[chainId].getBalance({ address }); // [!code focus]

  const account = await db.query.accounts.findFirst({
    where: eq(schema.accounts.address, address),
  });

  return c.json({ balance, account });
});

export default app;
```

#### Custom log filters

The `contracts.filter` property now supports multiple log filters, and requires argument values. [Read more](/docs/config/contracts#filter).

## 0.8

### Breaking changes

:::warning
This release includes an irreversible migration to the `ponder_sync` schema (RPC request cache). Once you run a `0.8` app against a database, you can no longer run `<=0.7` apps against the same database.
:::

#### Database management

Ponder now requires the database schema to be explicitly specified with an environment variable or CLI flag. **`onchainSchema()` is removed.**

```bash [.env.local]
DATABASE_SCHEMA=my_schema
```

```bash [shell]
ponder start --schema my_schema
```

:::info
Each deployment/instance of a Ponder app must have it's own schema, with some exceptions for `ponder dev` and crash recovery. [Read more](/docs/database#database-schema).
:::

#### Railway

Railway users should [update the start command](/docs/production/railway#create-a-ponder-app-service) to include a database schema.

::::code-group
```bash [pnpm]
pnpm start --schema $RAILWAY_DEPLOYMENT_ID
```

```bash [yarn]
yarn start --schema $RAILWAY_DEPLOYMENT_ID
```

```bash [npm]
npm run start -- --schema $RAILWAY_DEPLOYMENT_ID
```
::::

#### `@ponder/core` → `ponder`

New versions will be published to `ponder` and not `@ponder/core`.

:::code-group
```bash [pnpm]
pnpm remove @ponder/core
pnpm add ponder
```

```bash [yarn]
yarn remove @ponder/core
yarn add ponder
```

```bash [npm]
npm remove @ponder/core
npm add ponder
```
:::

#### `@/generated` → `ponder:registry`

The virtual module `@/generated` was replaced with `ponder:registry`.

```diff [src/index.ts]
- import { ponder } from "@/generated";
+ import { ponder } from "ponder:registry";
```

#### `factory()` function

The `factory()` function replaces the `factory` property in the contract config. The result should be passed to the `address` property.

:::code-group

```ts [ponder.config.ts (0.7 and below)]
import { createConfig } from "@ponder/core";

export default createConfig({
  contracts: {
    uniswap: {
      factory: { // [!code focus]
        address: "0x1F98431c8aD98523631AE4a59f267346ea31F984", // [!code focus]
        event: getAbiItem({ abi: UniswapV3FactoryAbi, name: "PoolCreated" }), // [!code focus]
        parameter: "pool", // [!code focus]
      }, // [!code focus]
    },
  },
});
```

```ts [ponder.config.ts (0.8)]
import { createConfig, factory } from "ponder"; // [!code focus]

export default createConfig({
  contracts: {
    uniswap: {
      address: factory({ // [!code focus]
        address: "0x1F98431c8aD98523631AE4a59f267346ea31F984", // [!code focus]
        event: getAbiItem({ abi: UniswapV3FactoryAbi, name: "PoolCreated" }), // [!code focus]
        parameter: "pool", // [!code focus]
      }), // [!code focus]
    },
  },
});
```

:::

#### `ponder-env.d.ts`

This release updates the `ponder-env.d.ts` file. The new file uses [triple slash directives](https://www.typescriptlang.org/docs/handbook/triple-slash-directives.html#-reference-types-) for less frequent updates.

:::code-group
```bash [pnpm]
pnpm codegen
```

```bash [yarn]
yarn codegen
```

```bash [npm]
npm run codegen
```
:::

#### Removed `transactionReceipt.logs`

The `transactionReceipt.logs` property was removed from the `event` object.

#### Removed redundant properties from `event`

The following properties were removed from the `event` object.

```diff
- event.log.blockNumber;
- event.log.blockHash;
- event.log.transactionHash;
- event.log.transactionIndex;
- event.transaction.blockNumber;
- event.transaction.blockHash;
- event.transactionReceipt.transactionHash;
- event.transactionReceipt.transactionIndex;
```

All of the data is still available on other properties of the `event` object, such as `event.transaction.hash` or `event.block.number`.


### New features

#### Account indexing

A new event source `accounts` is available. Accounts can be used to index transactions and native transfers to and from an address. [Read more](/docs/config/accounts).

#### `ponder:schema` alias

The `ponder:schema` virtual module was added. It is an alias for `ponder.schema.ts`.

```diff [src/index.ts]
- import { accounts } from "../ponder.schema";
+ import { accounts } from "ponder:schema";
```

It also contains a default export of all the exported table objects from `ponder.schema.ts`.

```ts [src/index.ts] {1,3}
import schema from "ponder:schema";
 
const row = await db.insert(schema.accounts).values({
  address: "0x7Df1", balance: 0n
});
```

#### `ponder db list`

A new command was added for more visibility into which database schemas are being used.

```bash [shell]
$ ponder db list

│ Schema        │ Active   │ Last active    │ Table count │
├───────────────┼──────────┼────────────────┼─────────────┤
│ indexer_prod  │      yes │            --- │          10 │
│ test          │       no │    26m 58s ago │          10 │
│ demo          │       no │      1 day ago │           5 │
```

## 0.7

### Breaking changes

This release includes several breaking changes.

::::steps

#### Install & run codegen

:::code-group
```bash [pnpm]
pnpm add @ponder/core@0.7
```

```bash [yarn]
yarn add @ponder/core@0.7
```

```bash [npm]
npm add @ponder/core@0.7
```
:::

To ensure strong type safety during the migration, regenerate `ponder-env.d.ts`.

:::code-group
```bash [pnpm]
pnpm codegen
```

```bash [yarn]
yarn codegen
```

```bash [npm]
npm run codegen
```
:::

#### Migrate `ponder.schema.ts`

Here's a table defined with the new schema definition API, which uses [Drizzle](https://orm.drizzle.team/docs/overview) under the hood.

```ts [ponder.schema.ts (after)]
import { onchainTable } from "@ponder/core";

export const accounts = onchainTable("account", (t) => ({
  address: t.hex().primaryKey(),
  daiBalance: t.bigint().notNull(),
  isAdmin: t.boolean().notNull(),
  graffiti: t.text(),
}));
```

Key changes:

1. Declare tables with the `onchainTable` function exported from `@ponder/core`
2. Export all table objects from `ponder.schema.ts`
3. Use `.primaryKey()` to mark the primary key column
4. Columns are nullable by default, use `.notNull()` to add the constraint
5. The `hex` column type now uses `TEXT` instead of `BYTEA`
6. `p.float()` (`DOUBLE PRECISION`) was removed, use `t.doublePrecision()` or `t.real()` instead

The new `onchainTable` function adds several new capabilities.

- Custom primary key column name (other than `id`)
- Composite primary keys
- Default column values

Here's a more advanced example with indexes and a composite primary key.

```ts [ponder.schema.ts]
import { onchainTable, index, primaryKey } from "@ponder/core";

export const transferEvents = onchainTable(
  "transfer_event",
  (t) => ({
    id: t.text().primaryKey(),
    amount: t.bigint().notNull(),
    timestamp: t.integer().notNull(),
    from: t.hex().notNull(),
    to: t.hex().notNull(),
  }),
  (table) => ({
    fromIdx: index().on(table.from),
  })
);

export const allowance = onchainTable(
  "allowance",
  (t) => ({
    owner: t.hex().notNull(),
    spender: t.hex().notNull(),
    amount: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.owner, table.spender] }),
  })
);

export const approvalEvent = onchainTable("approval_event", (t) => ({
  id: t.text().primaryKey(),
  amount: t.bigint().notNull(),
  timestamp: t.integer().notNull(),
  owner: t.hex().notNull(),
  spender: t.hex().notNull(),
}));
```

#### Migrate indexing functions

This release updates the indexing function database API to offer a unified SQL experience based on Drizzle.

Here's an indexing function defined with the new API, which uses the table objects exported from `ponder.schema.ts`.

```ts [src/index.ts]
import { ponder } from "@/generated";
import { account } from "../ponder.schema";

ponder.on("ERC20:Transfer", async ({ event, context }) => {
  await context.db
    .insert(account)
    .values({ 
      address: event.args.from, 
      balance: 0n, 
      isOwner: false,
    })
    .onConflictDoUpdate((row) => ({
      balance: row.balance - event.args.amount,
    }));
});
```

Key changes:

1. Transition from ORM pattern `db.Account.create({ ... }){:ts}` to query builder pattern `db.insert(accounts, { ... }){:ts}`
2. Import table objects from `ponder.schema.ts`
3. Replace `findMany` with `db.sql.select(...)` or `db.sql.query(...)`

Here is a simple migration example to familiarize yourself with the API.

:::code-group

```ts [src/index.ts (0.6 and below)]
// Create a single allowance
await context.db.Allowance.create({
  id: event.log.id,
  data: {
    owner: event.args.owner,
    spender: event.args.spender,
    amount: event.args.amount,
  },
});
```

```ts [src/index.ts (0.7)]
import { allowance } from "../ponder.schema";

// Create a single allowance
await context.db
  .insert(allowance)
  .values({
    id: event.log.id,
    owner: event.args.owner,
    spender: event.args.spender,
    amount: event.args.amount,
  });
```

:::

Here is a reference for how to migrate each method.

```ts [src/index.ts]
// create -> insert
await context.db.Account.create({
  id: event.args.from,
  data: { balance: 0n },
});
await context.db.insert(account).values({ id: event.args.from, balance: 0n });

// createMany -> insert
await context.db.Account.createMany({
  data: [
    { id: event.args.from, balance: 0n },
    { id: event.args.to, balance: 0n },
  ],
});
await context.db.insert(account).values([
  { id: event.args.from, balance: 0n },
  { id: event.args.to, balance: 0n },
]);

// findUnique -> find
await context.db.Account.findUnique({ id: event.args.from });
await context.db.find(account, { address: event.args.from });

// update
await context.db.Account.update({
  id: event.args.from,
  data: ({ current }) => ({ balance: current.balance + 100n }),
});
await context.db
  .update(account, { address: event.args.from })
  .set((row) => ({ balance: row.balance + 100n }));

// upsert
await context.db.Account.upsert({
  id: event.args.from,
  create: { balance: 0n },
  update: ({ current }) => ({ balance: current.balance + 100n }),
});
await context.db
  .insert(account)
  .values({ address: event.args.from, balance: 0n })
  .onConflictDoUpdate((row) => ({ balance: row.balance + 100n }));

// delete
await context.db.Account.delete({ id: event.args.from });
await context.db.delete(account, { address: event.args.from });

// findMany -> raw SQL select, see below
await context.db.Account.findMany({ where: { balance: { gt: 100n } } });
await context.db.sql.select().from(account).where(eq(account.balance, 100n));

// updateMany -> raw SQL update, see below
await context.db.Player.updateMany({
  where: { id: { startsWith: "J" } },
  data: { age: 50 },
});
await context.db.sql
  .update(player)
  .set({ age: 50 })
  .where(like(player.id, "J%"));
```

Finally, another migration example for an ERC20 Transfer indexing function using `upsert`.

:::code-group

```ts [src/index.ts (0.6 and below)]
import { ponder } from "@/generated";

ponder.on("ERC20:Transfer", async ({ event, context }) => {
  const { Account, TransferEvent } = context.db;

  await Account.upsert({
    id: event.args.from,
    create: {
      balance: BigInt(0),
      isOwner: false,
    },
    update: ({ current }) => ({
      balance: current.balance - event.args.amount,
    }),
  });
});
```

```ts [src/index.ts (0.7)]
import { ponder } from "@/generated";
import { account } from "../ponder.schema";

ponder.on("ERC20:Transfer", async ({ event, context }) => {
  await context.db
    .insert(account)
    .values({
      address: event.args.from,
      balance: 0n, 
      isOwner: false,
    })
    .onConflictDoUpdate((row) => ({
      balance: row.balance - event.args.amount,
    }));
});
```

:::

#### Migrate API functions

- Removed `c.tables` in favor of importing table objects from `ponder.schema.ts`

::::

### New features

#### Arbitrary SQL within indexing functions

The new `context.db.sql` interface replaces the rigid `findMany` method and supports any valid SQL `select` query.

```ts [src/index.ts]
import { desc } from "@ponder/core";
import { account } from "../ponder.schema";

ponder.on("...", ({ event, context }) => {
  const result = await context.db.sql
    .select()
    .from(account)
    .orderBy(desc(account.balance))
    .limit(1);
});
```

## 0.6.0

### Breaking changes

#### Updated `viem` to `>=2`

This release updates the `viem` peer dependency requirement to `>=2`. The `context.client` action `getBytecode` was renamed to `getCode`.

:::code-group
```bash [pnpm]
pnpm add viem@latest
```

```bash [yarn]
yarn add viem@latest
```

```bash [npm]
npm install viem@latest
```
:::

#### Simplified Postgres schema pattern

Starting with this release, the indexed tables, reorg tables, and metadata table for a Ponder app are contained in one Postgres schema, specified by the user in `ponder.config.ts` (defaults to `public`). This means the shared `ponder` schema is no longer used. (Note: The `ponder_sync` schema is still in use).

This release also removes the view publishing pattern and the `publishSchema` option from `ponder.config.ts`, which may disrupt production setups using horizontal scaling or direct SQL. If you relied on the publish pattern, please [get in touch on Telegram](https://t.me/kevinkoste) and we'll work to get you unblocked.

### New features

#### Added `/ready`, updated `/health`

The new `/ready` endpoint returns an HTTP `200` response once the app **is ready to serve requests**. This means that historical indexing is complete and the app is indexing events in realtime.

The existing `/health` endpoint now returns an HTTP `200` response as soon as the process starts. (This release removes the `maxHealthcheckDuration` option, which previously governed the behavior of `/health`.)

For Railway users, we now recommend using `/ready` as the health check endpoint to enable zero downtime deployments. If your app takes a while to sync, be sure to set the healthcheck timeout accordingly. Read the [Railway deployment guide](/docs/production/railway#create-a-ponder-app-service) for more details.


## 0.5.0

### Breaking changes

#### `hono` peer dependency

This release adds [Hono](https://hono.dev) as a peer dependency. After upgrading, install `hono` in your project.

:::code-group
```bash [pnpm]
pnpm add hono@latest
```

```bash [yarn]
yarn add hono@latest
```

```bash [npm]
npm install hono@latest
```
:::

### New features

#### Introduced custom API endpoints

This release added support for API functions. [Read more](/docs/query/api-endpoints).

## 0.4.0

### Breaking changes

This release changes the location of database tables when using both SQLite and Postgres. It **does not** require any changes to your application code, and does not bust the sync cache for SQLite or Postgres.

#### New database layout

Please read the new docs on [direct SQL](/docs/query/direct-sql) for a detailed overview.

**SQLite**

Ponder now uses the `.ponder/sqlite/public.db` file for indexed tables. Before, the tables were present as views in the `.ponder/sqlite/ponder.db`. Now, the`.ponder/sqlite/ponder.db` file is only used internally by Ponder.

**Postgres**

Ponder now creates a table in the `public` schema for each table in `ponder.schema.ts`. Before, Ponder created them as views in the `ponder` schema.

Isolation while running multiple Ponder instances against the same database also works differently. Before, Ponder used a schema with a pseudorandom name if the desired schema was in use. Now, Ponder will fail on startup with an error if it cannot acquire a lock on the desired schema.

This also changes the zero-downtime behavior on platforms like Railway. For more information on how this works in `0.4`, please reference:

- [Direct SQL](/docs/query/direct-sql)
- [Zero-downtime deployments](/docs/production/self-hosting#database-schema)

**Postgres table cleanup**

After upgrading to `0.4`, you can run the following Postgres SQL script to clean up stale tables and views created by `0.3` Ponder apps.

**Note:** This script could obviously be destructive, so please read it carefully before executing.

```sql [cleanup.sql]
DO $$
DECLARE
    view_name TEXT;
    schema_name_var TEXT;
BEGIN
    -- Drop all views from the 'ponder' schema
    FOR view_name IN SELECT table_name FROM information_schema.views WHERE table_schema = 'ponder'
    LOOP
        EXECUTE format('DROP VIEW IF EXISTS ponder.%I CASCADE', view_name);
        RAISE NOTICE 'Dropped view "ponder"."%"', view_name;
    END LOOP;

    -- Drop the 'ponder_cache' schema
    EXECUTE 'DROP SCHEMA IF EXISTS ponder_cache CASCADE';
    RAISE NOTICE 'Dropped schema "ponder_cache"';

    -- Find and drop any 'ponder_instance_*' schemas
    FOR schema_name_var IN SELECT schema_name AS schema_name_alias FROM information_schema.schemata WHERE schema_name LIKE 'ponder_instance_%'
    LOOP
        EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', schema_name_var);
        RAISE NOTICE 'Dropped schema "%"', schema_name_var;
    END LOOP;
END $$;
```

## 0.3.0

### Breaking changes

#### Moved SQLite directory

**Note:** This release busted the SQLite sync cache.

The SQLite database was moved from the `.ponder/store` directory to `.ponder/sqlite`. The old `.ponder/store` directory will still be used by older versions.

#### Moved Postgres sync tables

Similar to SQLite, the sync tables for Postgres were moved from the `public` schema to `ponder_sync`. Now, Ponder does not use the `public` schema whatsoever.

This change did NOT bust the sync cache; the tables were actually moved. This process emits some `WARN`-level logs that you should see after upgrading.

## 0.2.0

### Breaking changes

#### Replaced `p.bytes()` with `p.hex()`

Removed `p.bytes()` in favor of a new `p.hex()` primitive column type. `p.hex()` is suitable for Ethereum addresses and other hex-encoded data, including EVM `bytes` types. `p.hex()` values are stored as `bytea` (Postgres) or `blob` (SQLite). To migrate, replace each occurrence of `p.bytes()` in `ponder.schema.ts` with `p.hex()`, and ensure that any values you pass into hex columns are valid hexadecimal strings. The GraphQL API returns `p.hex()` values as hexadecimal strings, and allows sorting/filtering on `p.hex()` columns using the numeric comparison operators (`gt`, `gte`, `le`, `lte`).

### New features

#### Cursor pagination

Updated the GraphQL API to use cursor pagination instead of offset pagination. Note that this change also affects the `findMany` database method. See the [GraphQL pagination docs](/docs/query/graphql#pagination) for more details.

## 0.1

### Breaking changes

#### Config

- In general, `ponder.config.ts` now has much more static validation using TypeScript. This includes network names in `contracts`, ABI event names for the contract `event` and `factory` options, and more.
- The `networks` and `contracts` fields were changed from an array to an object. The network or contract name is now specified using an object property name. The `name` field for both networks and contracts was removed.
- The `filter` field has been removed. To index all events matching a specific signature across all contract addresses, add a contract that specifies the `event` field without specifying an `address`.
- The `abi` field now requires an ABI object that has been asserted as const (cannot use a file path). See the ABIType documentation for more details.

#### Schema

- The schema definition API was rebuilt from scratch to use a TypeScript file `ponder.schema.ts` instead of `schema.graphql`. The `ponder.schema.ts` file has static validation using TypeScript.
- Note that it is possible to convert a `schema.graphql` file into a `ponder.schema.ts` file without introducing any breaking changes to the autogenerated GraphQL API schema.
- Please see the `design your schema` guide for an overview of the new API.

#### Indexing functions

- `event.params` was renamed to `event.args` to better match Ethereum terminology norms.
- If a contract uses the `event` option, only the specified events will be available for registration. Before, all events in the ABI were available.
- `context.models` was renamed to `context.db`
- Now, a read-only Viem client is available at `context.client`. This client uses the same transport you specify in `ponder.config.ts`, except all method are cached to speed up subsequent indexing.
- The `context.contracts` object now contains the contract addresses and ABIs specified in`ponder.config.ts`, typed as strictly as possible. (You should not need to copy addresses and ABIs around anymore, just use `context.contracts`).
- A new `context.network` object was added which contains the network name and chain ID that the current event is from.

#### Multi-chain indexing

- The contract `network` field `ponder.config.ts` was upgraded to support an object of network-specific overrides. This is a much better DX for indexing the same contract on multiple chains.
- The options that you can specify per-network are `address`, `event`, `startBlock`, `endBlock`, and `factory`.
- When you add a contract on multiple networks, Ponder will sync the contract on each network you specify. Any indexing functions you register for the contract will now process events across all networks.
- The `context.network` object is typed according to the networks that the current contract runs on, so you can write network-specific logic like `if (context.network.name === "optimism") { …`

#### Vite

- Ponder now uses Vite to transform and load your code. This means you can import files from outside the project root directory.
- Vite's module graph makes it possible to invalidate project files granularly, only reloading the specific parts of your app that need to be updated when a specific file changes. For example, if you save a change to one of your ABI files, `ponder.config.ts` will reload because it imports that file, but your schema will not reload.
- This update also unblocks a path towards concurrent indexing and granular caching of indexing function results.
# Chains [Configure chain IDs and RPC endpoints]

Use the `chains` field in `ponder.config.ts` to configure chain IDs and names, RPC endpoints, and connection options.

This guide describes each configuration option and suggests patterns for common use cases. Visit the config [API reference](/docs/api-reference/ponder/config) for more information.

## Example

This config sets up two chains: Ethereum mainnet and Optimism.

```ts [ponder.config.ts]
import { createConfig } from "ponder";

export default createConfig({
  chains: {
    mainnet: {
      id: 1,
      rpc: process.env.PONDER_RPC_URL_1,
    },
    optimism: {
      id: 10,
      rpc: [
        process.env.PONDER_RPC_URL_10,
        "https://optimism.llamarpc.com",
      ],
    },
  },
  contracts: { /* ... */ },
});
```

## Name

Each chain must have a unique name, provided as a key to the `chains` object. The contract, account, and block interval `chain` options reference the chain name.

Within indexing functions, the `context.chain.name` property contains the chain name of the current event.

```ts [ponder.config.ts]
import { createConfig } from "ponder";

export default createConfig({
  chains: {
    mainnet: { // [!code focus]
      id: 1,
      rpc: process.env.PONDER_RPC_URL_1,
    },
  },
  contracts: {
    Blitmap: {
      abi: BlitmapAbi,
      chain: "mainnet", // [!code focus]
      address: "0x8d04a8c79cEB0889Bdd12acdF3Fa9D207eD3Ff63",
    },
  },
});
```

## Chain ID

Use the `id` field to specify a unique [Chain ID](https://chainlist.org) for each chain. Within indexing functions, the `context.chain.id` property contains the chain ID of the current event.

The indexing engine uses `id` in the cache key for RPC responses. To avoid cache issues, make sure `id` always matches the chain ID of the configured RPC endpoint.

```ts [ponder.config.ts]
import { createConfig } from "ponder";

export default createConfig({
  chains: {
    mainnet: {
      id: 1, // [!code focus]
      rpc: "https://eth.llamarpc.com",
    },
  },
  contracts: { /* ... */ },
});
```

:::info
  Ponder does not support chain IDs greater than JavaScript's `Number.MAX_SAFE_INTEGER` (9007199254740991).
:::

## RPC endpoints

:::warning
  Most Ponder apps require a paid RPC provider plan to avoid rate-limiting.
:::

Use the `rpc` field to provide one or more RPC endpoints for each chain.

Ponder dynamically adapts to provider rate limits to avoid 429 errors and maximize performance. Providing multiple endpoints enables intelligent load balancing and fallback logic to improve reliability.

```ts [ponder.config.ts]
import { createConfig } from "ponder";

export default createConfig({
  chains: {
    mainnet: {
      id: 1,
      rpc: "https://eth-mainnet.g.alchemy.com/v2/...", // [!code focus]
    },
  },
  contracts: { /* ... */ },
});
```

### Custom transport

The `rpc` field also accepts a [Viem Transport](https://viem.sh/docs/clients/intro#transports), which can be useful if you need more granular control over how RPC requests are made.

```ts [ponder.config.ts]
import { createConfig } from "ponder";
import { http, fallback } from "viem"; // [!code focus]

export default createConfig({
  chains: {
    mainnet: {
      id: 1,
      rpc: fallback([ // [!code focus]
        http("https://eth-mainnet.g.alchemy.com/v2/..."), // [!code focus]
        http("https://quaint-large-card.quiknode.pro/..."), // [!code focus]
      ]), // [!code focus]
    },
  },
});
```

Here are a few common transport options.

* [`http`](https://viem.sh/docs/clients/transports/http)
* [`webSocket`](https://viem.sh/docs/clients/transports/websocket)
* [`fallback`](https://viem.sh/docs/clients/transports/fallback)
* [`loadBalance`](/docs/api-reference/ponder-utils#loadbalance)
* [`rateLimit`](/docs/api-reference/ponder-utils#ratelimit)

## WebSocket

Use the optional `ws` field to specify a WebSocket RPC endpoint for each chain.

When provided, Ponder will use WebSocket connections for realtime block subscriptions instead of polling. Websocket connections typically offer lower latency and reduced RPC usage.

:::info
  If the WebSocket connection becomes unstable or fails, Ponder automatically falls back to the default polling mechanism to ensure continuous indexing.
:::

```ts [ponder.config.ts]
import { createConfig } from "ponder";

export default createConfig({
  chains: {
    mainnet: {
      id: 1,
      rpc: "https://eth-mainnet.g.alchemy.com/v2/...",
      ws: "wss://eth-mainnet.g.alchemy.com/v2/...", // [!code focus]
    },
  },
  contracts: { /* ... */ },
});
```

## Polling interval

The `pollingInterval` option controls how frequently (in milliseconds) the indexing engine checks for a new block in realtime. The default is `1000` (1 second).

If you set `pollingInterval` greater than the chain's block time, it **does not reduce RPC usage**. The indexing engine still fetches every block to check for reorgs. The default is suitable for most chains.

```ts [ponder.config.ts]
import { createConfig } from "ponder";

export default createConfig({
  chains: {
    mainnet: {
      id: 1,
      rpc: process.env.PONDER_RPC_URL_1,
      pollingInterval: 2_000, // 2 seconds [!code focus]
    },
  },
});
```

## Disable caching

Use the `disableCache` option to disable caching for RPC responses. The default is `false`.

Set this option to `true` when indexing a development node like Anvil, where the chain state / history may change. [Read more](/docs/guides/foundry) about indexing Anvil.

```ts [ponder.config.ts]
import { createConfig } from "ponder";

export default createConfig({
  chains: {
    anvil: {
      id: 31337,
      rpc: "http://127.0.0.1:8545",
      disableCache: true, // [!code focus]
    },
  },
});
```
# Contracts [Index events emitted by a contract]

To index **event logs** or **call traces** produced by a contract, use the `contracts` field in `ponder.config.ts`.

This guide describes each configuration option and suggests patterns for common use cases. Visit the config [API reference](/docs/api-reference/ponder/config) for more information.

## Example

This config instructs the indexing engine to fetch event logs emitted by the [Blitmap](https://blitmap.xyz/) NFT contract.

```ts [ponder.config.ts]
import { createConfig } from "ponder";
import { BlitmapAbi } from "./abis/Blitmap";

export default createConfig({
  chains: {
    mainnet: { id: 1, rpc: process.env.PONDER_RPC_URL_1 },
  },
  contracts: {
    Blitmap: {
      abi: BlitmapAbi,
      chain: "mainnet",
      address: "0x8d04a8c79cEB0889Bdd12acdF3Fa9D207eD3Ff63",
      startBlock: 12439123,
    },
  },
});
```

Now, we can register an indexing function for the `MetadataChanged` event that will be called for each event log. In this case, the indexing function inserts or updates a row in the `tokens` table.

```ts [src/index.ts]
import { ponder } from "ponder:registry";
import { tokens } from "ponder:schema";

ponder.on("Blitmap:MetadataChanged", async ({ event, context }) => {
  await context.db
    .insert(tokens)
    .values({
      id: event.args.tokenId,
      metadata: event.args.newMetadata,
    })
    .onConflictDoUpdate({
      metadata: event.args.newMetadata,
    });
});
```

[Read more](/docs/indexing/overview) about writing indexing functions.

## Name

Each contract must have a unique name, provided as a key to the `contracts` object. Names must be unique across contracts, accounts, and block intervals.

```ts [ponder.config.ts]
import { createConfig } from "ponder";
import { BlitmapAbi } from "./abis/Blitmap";

export default createConfig({
  chains: { /* ... */ },
  contracts: {
    Blitmap: { // [!code focus]
      abi: BlitmapAbi,
      chain: "mainnet",
      address: "0x8d04a8c79cEB0889Bdd12acdF3Fa9D207eD3Ff63",
    },
  },
});
```

## ABI

Each contract must have an ABI. The indexing engine uses the ABI to validate inputs and encode & decode contract data.

```ts [ponder.config.ts]
import { createConfig } from "ponder";
import { BlitmapAbi } from "./abis/Blitmap"; 

export default createConfig({
  chains: {
    mainnet: { id: 1, rpc: process.env.PONDER_RPC_URL_1 },
  },
  contracts: {
    Blitmap: {
      abi: BlitmapAbi,
      chain: "mainnet",
      address: "0x8d04a8c79cEB0889Bdd12acdF3Fa9D207eD3Ff63",
      startBlock: 
    },
  },
});
```

To enable the type system, save all ABIs in `.ts` files and include an `as const{:ts}` assertion. Read more about these requirements in the [ABIType](https://abitype.dev/guide/getting-started#usage) documentation.

```ts [abis/Blitmap.ts]
export const BlitmapAbi = [ // [!code focus]
  { inputs: [], stateMutability: "nonpayable", type: "constructor" },
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // ...
] as const; // [!code focus]
```

### Multiple ABIs

Use the [`mergeAbis`](/docs/api-reference/ponder-utils#mergeabis) utility function to combine multiple ABIs into one. This function removes duplicate ABI items and maintains strict types.

This pattern is often useful for proxy contracts where the implementation ABI has changed over time.

```ts [ponder.config.ts]
import { createConfig, mergeAbis } from "ponder"; // [!code focus]
import { ERC1967ProxyAbi } from "./abis/ERC1967Proxy";
import { NameRegistryAbi } from "./abis/NameRegistry";
import { NameRegistry2Abi } from "./abis/NameRegistry2";

export default createConfig({
  chains: { /* ... */ },
  contracts: {
    FarcasterNameRegistry: {
      abi: mergeAbis([ERC1967ProxyAbi, NameRegistryAbi, NameRegistry2Abi]), // [!code focus]
      chain: "goerli",
      address: "0xe3Be01D99bAa8dB9905b33a3cA391238234B79D1",
    },
  },
});
```

## Chain

### Single chain

To index a contract on a single chain, pass the chain name as a string to the `chain` field.

```ts [ponder.config.ts]
import { createConfig } from "ponder";
import { BlitmapAbi } from "./abis/Blitmap";

export default createConfig({
  chains: {
    mainnet: { id: 1, rpc: process.env.PONDER_RPC_URL_1 }, // [!code focus]
  },
  contracts: {
    Blitmap: {
      abi: BlitmapAbi,
      chain: "mainnet", // [!code focus]
      address: "0x8d04a8c79cEB0889Bdd12acdF3Fa9D207eD3Ff63",
    },
  },
});
```

### Multiple chains

To index a contract that exists on multiple chains, pass an object to the `chain` field containing chain-specific overrides. Each contract specified this way _must_ have the same ABI.

```ts [ponder.config.ts]
import { createConfig } from "ponder";
import { UniswapV3FactoryAbi } from "./abis/UniswapV3Factory";

export default createConfig({
  chains: {
    mainnet: { id: 1, rpc: process.env.PONDER_RPC_URL_1 }, // [!code focus]
    base: { id: 8453, rpc: process.env.PONDER_RPC_URL_8453 }, // [!code focus]
  },
  contracts: {
    UniswapV3Factory: {
      abi: UniswapV3FactoryAbi,
      chain: { // [!code focus]
        mainnet: { // [!code focus]
          address: "0x1F98431c8aD98523631AE4a59f267346ea31F984", // [!code focus]
          startBlock: 12369621, // [!code focus]
        }, // [!code focus]
        base: { // [!code focus]
          address: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD", // [!code focus]
          startBlock: 1371680, // [!code focus]
        }, // [!code focus]
      }, // [!code focus]
    },
  },
});
```

With this configuration, the indexing functions you register for the `UniswapV3Factory` contract will handle events from both Ethereum and Base.

To determine which chain the current event is from, use the `context.chain` object.

```ts [src/index.ts]
import { ponder } from "ponder:registry";

ponder.on("UniswapV3Factory:Ownership", async ({ event, context }) => {
  context.chain;
  //      ^? { name: "mainnet", id: 1 } | { name: "base", id: 8453 }

  event.log.address;
  //        ^? "0x1F98431c8aD98523631AE4a59f267346ea31F984" | "0x33128a8fC17869897dcE68Ed026d694621f6FDfD"

  if (context.chain.name === "mainnet") {
    // Do mainnet-specific stuff!
  }
});
```

#### Chain override logic

Chain-specific configuration uses an override pattern. Any options defined at the top level are the default, and the chain-specific objects override those defaults.

All contract options other than `abi` can be specified per-chain, including `address`, `startBlock`, and `endBlock`.

**Example: Uniswap V3**

The Uniswap V3 factory contract is deployed to the same address on most chains, but has a different address on Base. This configuration instructs Ponder to use the address defined at the top level (`"0x1F98..."`) for mainnet and Optimism, and the address defined in the `base` object for Base.

```ts [ponder.config.ts]
import { createConfig } from "ponder";
import { UniswapV3FactoryAbi } from "./abis/EntryPoint";

export default createConfig({
  chains: {
    mainnet: { id: 1, rpc: process.env.PONDER_RPC_URL_1 },
    optimism: { id: 10, rpc: process.env.PONDER_RPC_URL_10 },
    base: { id: 8453, rpc: process.env.PONDER_RPC_URL_8453 },
  },
  contracts: {
    UniswapV3Factory: {
      abi: UniswapV3FactoryAbi,
      address: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      chain: { // [!code focus]
        mainnet: { startBlock: 12369621 }, // [!code focus]
        optimism: { startBlock: 0 }, // [!code focus]
        base: { // [!code focus]
          address: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD", // [!code focus]
          startBlock: 1371680, // [!code focus]
        }, // [!code focus]
      }, // [!code focus]
    },
  },
});
```

**Example: ERC-4337 EntryPoint**

The ERC-4337 EntryPoint contract is deployed to the same address on all chains. Only the `startBlock` needs to be specified per-chain.

```ts [ponder.config.ts]
import { createConfig } from "ponder";
import { EntryPointAbi } from "./abis/EntryPoint";

export default createConfig({
  chains: {
    mainnet: { id: 1, rpc: process.env.PONDER_RPC_URL_1 },
    optimism: { id: 10, rpc: process.env.PONDER_RPC_URL_10 },
  },
  contracts: {
    EntryPoint: {
      abi: EntryPointAbi,
      address: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      chain: { // [!code focus]
        mainnet: { startBlock: 12369621 }, // [!code focus]
        optimism: { startBlock: 88234528 }, // [!code focus]
      }, // [!code focus]
    },
  },
});
```

## Address

### Single address

The simplest and most common option is to pass a single static address.

```ts [ponder.config.ts]
import { createConfig } from "ponder";
import { BlitmapAbi } from "./abis/Blitmap";

export default createConfig({
  chains: { /* ... */ },
  contracts: {
    Blitmap: {
      abi: BlitmapAbi,
      chain: "mainnet",
      address: "0x8d04a8c79cEB0889Bdd12acdF3Fa9D207eD3Ff63", // [!code focus]
    },
  },
});
```

### Multiple addresses

To index multiple contracts that have the same ABI (or share an interface like `ERC20`), pass a list of addresses to the `address` field.

:::info
  With this configuration, all addresses share the same `startBlock`. It's
  often best to use the earliest deployment block among them.
:::

```ts [ponder.config.ts]
import { createConfig } from "ponder";
import { ERC721Abi } from "./abis/ERC721";

export default createConfig({
  chains: { /* ... */ },
  contracts: {
    NiceJpegs: {
      abi: ERC721Abi,
      chain: "mainnet",
      address: [ // [!code focus]
        "0x4E1f41613c9084FdB9E34E11fAE9412427480e56", // Terraforms // [!code focus]
        "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D", // BAYC // [!code focus]
        "0x8a90CAb2b38dba80c64b7734e58Ee1dB38B8992e", // Doodles // [!code focus]
        "0x0000000000664ceffed39244a8312bD895470803", // !fundrop // [!code focus]
      ], // [!code focus]
    },
  },
});
```

### Factory pattern

:::info
  Visit the [factory pattern](/docs/guides/factory) guide for more information.
:::

Use the `factory()` function to specify a dynamic list of addresses collected from a factory contract.

Any indexing functions you register for `SudoswapPool` receive events for all contracts matched by the factory configuration (similar to a multiple chain configuration). The `event.log.address` field contains the address of the specific contract that emitted the current event.

:::code-group

```ts [ponder.config.ts]
import { createConfig, factory } from "ponder"; // [!code focus]
import { parseAbiItem } from "viem";

export default createConfig({
  chains: { /* ... */ },
  contracts: {
    SudoswapPool: {
      abi: SudoswapPoolAbi,
      chain: "mainnet",
      address: factory({ // [!code focus]
        // Address of the factory contract. // [!code focus]
        address: "0xb16c1342E617A5B6E4b631EB114483FDB289c0A4", // [!code focus]
        // Event from the factory contract ABI which contains the child address. // [!code focus]
        event: parseAbiItem("event NewPair(address poolAddress)"), // [!code focus]
        // Name of the event parameter containing the child address. // [!code focus]
        parameter: "poolAddress", // [!code focus]
      }), // [!code focus]
      startBlock: 14645816,
    },
  },
});
```

```ts [src/index.ts]
import { ponder } from "ponder:registry";

ponder.on("SudoswapPool:Transfer", async ({ event }) => {
  // The address of the child contract that emitted the event.
  event.log.address;
  //        ^? string
});
```

:::

### Proxy & upgradable contracts

To index a proxy/upgradable contract, use the proxy contract address in the `address` field. Then, be sure to include the ABIs of all implementation contracts that the proxy has ever had. The implementation ABIs are required to properly identify and decode all event logs throughout the contract history. To add multiple ABIs safely, use the [`mergeAbis`](/docs/api-reference/ponder-utils#mergeabis) utility function.

:::tip
  On Etherscan, there is a link to the current implementation contract on the **Contract → Read as Proxy** tab. You can copy all the implementation ABIs as text and paste them into `.ts` files.
:::

![Etherscan contract proxy address](/etherscan-proxy-contract.png)

## Block range

Use the `startBlock` and `endBlock` options to specify the block range to index.

```ts [ponder.config.ts]
import { createConfig } from "ponder";
import { BlitmapAbi } from "./abis/Blitmap";

export default createConfig({
  chains: { /* ... */ },
  contracts: {
    Blitmap: {
      abi: BlitmapAbi,
      chain: "mainnet",
      address: "0x8d04a8c79cEB0889Bdd12acdF3Fa9D207eD3Ff63",
      startBlock: 16500000, // [!code focus]
      endBlock: 16501000, // [!code focus]
    },
  },
});
```

### Start block

The `startBlock` option specifies the block number to begin indexing from. The default is `0` – to avoid wasteful RPC requests, set `startBlock` to the contract deployment block number.

If you set `startBlock` to `"latest"`, the indexing engine will fetch the latest block on startup and use that value. This is the best way to skip the backfill and only index live blocks.

### End block

The `endBlock` option specifies the block number to stop indexing at. The default is `undefined`, which means that indexing will continue indefinitely with live blocks.

If you set `endBlock` to `"latest"`, the indexing engine will fetch the latest block on startup and use that value.

:::tip
  To speed up hot reloads during development, you can use `endBlock` to index a small slice of history.
:::


## Filter by indexed parameter value

:::warning
  You do **not** need to keep `filter` in sync with your indexing function registrations; the build step does this automatically. Most apps should not use `filter`.
:::

Sometimes, it's useful to filter for event logs that match specific [indexed parameter](https://docs.soliditylang.org/en/latest/contracts.html#events) values (topics).

This example filters for all `Transfer` events emitted by the USDC contract where the `from` argument matches the Binance 14 exchange address.

:::code-group

```ts [ponder.config.ts]
import { createConfig } from "ponder";
import { ERC20Abi } from "./abis/ERC20";

export default createConfig({
  chains: { /* ... */ },
  contracts: {
    USDC: {
      abi: ERC20Abi,
      chain: "mainnet",
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
      filter: { // [!code focus]
        event: "Transfer", // [!code focus]
        args: { // [!code focus]
          from: "0x28c6c06298d514db089934071355e5743bf21d60", // Binance 14 // [!code focus]
        }, // [!code focus]
      }, // [!code focus]
    },
  },
});
```

```ts [src/index.ts]
import { ponder } from "ponder:registry";

ponder.on("USDC:Transfer", async ({ event }) => {
  // This will always be "0x28c6c06298d514db089934071355e5743bf21d60"
  event.args.from;
});
```

:::

Note that the `filter` option accepts an array of filter configurations and that each field in the `args` object accepts a single value or a list of values to match.

## Call traces

:::info
  Visit the [call traces](/docs/guides/call-traces) guide for more information.
:::

Use the `includeCallTraces` option to enable call trace indexing for a contract, which makes it possible to register indexing functions for every _function_ present in the contract ABI.

Call traces are **disabled** by default. 

:::code-group
```ts [ponder.config.ts]
import { createConfig } from "ponder";
import { BlitmapAbi } from "./abis/Blitmap";

export default createConfig({
  chains: { /* ... */ },
  contracts: {
    Blitmap: {
      abi: BlitmapAbi,
      chain: "mainnet",
      address: "0x8d04a8c79cEB0889Bdd12acdF3Fa9D207eD3Ff63",
      includeCallTraces: true, // [!code focus]
    },
  },
});
```

```ts [src/index.ts]
import { ponder } from "ponder:registry";

ponder.on("Blitmap.mintOriginal()", async ({ event }) => {
  event.args;
  //    ^? [tokenData: Hex, name: string]
  event.trace.gasUsed;
  //          ^? bigint
});
```
:::

## Transaction receipts

:::info
  Visit the [transaction receipts](/docs/guides/receipts) guide for more information.
:::

Use the `includeTransactionReceipts` option to fetch the transaction receipt for each event. This will make the `event.transactionReceipt` object available in all indexing functions for the contract.

Transaction receipts are **disabled** by default.

:::code-group
```ts [ponder.config.ts]
import { createConfig } from "ponder";
import { BlitmapAbi } from "./abis/Blitmap";

export default createConfig({
  chains: { /* ... */ },
  contracts: {
    Blitmap: {
      abi: BlitmapAbi,
      chain: "mainnet",
      address: "0x8d04a8c79cEB0889Bdd12acdF3Fa9D207eD3Ff63",
      includeTransactionReceipts: true, // [!code focus]
    },
  },
});
```

```ts [src/index.ts]
import { ponder } from "ponder:registry";

ponder.on("Blitmap.mintOriginal()", async ({ event }) => {
  event.transactionReceipt.cumulativeGasUsed;
  //                       ^? bigint
  event.transactionReceipt.logs;
  //                       ^? Log[]
});
```
:::
# Accounts [Index transactions and native transfers]

To index **transactions** or **native transfers** sent to (or from) an address, use the `accounts` field in `ponder.config.ts`.

This guide describes each configuration option and suggests patterns for common use cases. Visit the config [API reference](/docs/api-reference/ponder/config) for more information.

:::warning
  The RPC methods that power account indexing (`eth_getBlockByNumber`, `debug_traceBlockByNumber`) do not support filtering the way `eth_getLogs` does. Large backfills may consume an impractical amount of RPC credits.
:::

## Example

This config instructs the indexing engine to fetch transactions or native transfers sent by the [Beaver](https://beaverbuild.org/) block builder account.

```ts [ponder.config.ts]
import { createConfig } from "ponder";

export default createConfig({
  chains: {
    mainnet: { id: 1, rpc: process.env.PONDER_RPC_URL_1 },
  },
  accounts: { // [!code focus]
    BeaverBuild: { // [!code focus]
      chain: "mainnet", // [!code focus]
      address: "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5", // [!code focus]
      startBlock: 20000000, // [!code focus]
    }, // [!code focus]
  }, // [!code focus]
});
```

Now, we can register an indexing function for the `transaction:from` event. The indexing engine will fetch all transactions where `from` matches the specified address, then call the indexing function for each transaction.

```ts [src/index.ts]
import { ponder } from "ponder:registry";
import { deposits } from "ponder:schema";

ponder.on("BeaverBuild:transaction:from", async ({ event, context }) => { // [!code focus]
  await context.db.insert(deposits).values({
    from: event.transaction.from,
    to: event.transaction.to,
    value: event.transaction.value,
    input: event.transaction.input,
  });
});
```

You can also register indexing functions for the `transaction:to`, `transfer:from`, and `transfer:to` events. [Read more](/docs/api-reference/ponder/config#accounts) about event types.

:::tip
  The indexing engine only fetches data required for _registered_ indexing functions. In this example, native transfers will **not** be fetched because no indexing functions were registered for `transfer:from` and `transfer:to`.
:::

## Name

Every account must have a unique name, provided as a key to the `accounts` object. Names must be unique across accounts, contracts, and block intervals.

```ts [ponder.config.ts]
import { createConfig } from "ponder";

export default createConfig({
  chains: { /* ... */ },
  accounts: {
    BeaverBuild: { // [!code focus]
      chain: "mainnet",
      address: "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5",
      startBlock: 12439123,
    },
  },
});
```

## Chain

The `chain` option for accounts works the same way as it does for contracts. You can specify a different `address`, `startBlock`, and `endBlock` for each chain.

[Read more](/docs/config/contracts#chain) in the contracts guide.

## Address

The `address` option for accounts works the same way as it does for contracts. You can provide a single address, a list of addresses, or an address factory. You can also specify chain-specific overrides.

[Read more](/docs/config/contracts#address) in the contracts guide.

## Block range

The `startBlock` and `endBlock` options for accounts work the same way as it does for contracts.

[Read more](/docs/config/contracts#block-range) in the contracts guide.

## Transaction receipts

The `includeTransactionReceipts` option for accounts works the same way as it does for contracts.

[Read more](/docs/config/contracts#transaction-receipts) in the contracts guide.
import { Callout } from "vocs/components";

# Block intervals [Run logic on a regular schedule]

To run indexing logic on a **regular schedule**, use the `blocks` field in `ponder.config.ts`. Block intervals are useful for aggregations, time-series logic, and bulk updates using raw SQL.

This guide describes each configuration option and suggests patterns for common use cases. Visit the config [API reference](/docs/api-reference/ponder/config) for more information.

## Example

This config instructs the indexing engine to run an indexing function every 10 blocks starting at the start block – `1000`, `1010`, `1020`, and so on.

```ts [ponder.config.ts]
import { createConfig } from "ponder";

export default createConfig({
  chains: {
    mainnet: { id: 1, rpc: process.env.PONDER_RPC_URL_1 },
  },
  blocks: {
    ChainlinkOracleUpdate: {
      chain: "mainnet",
      interval: 10, // Every 10 blocks
      startBlock: 1000,
    },
  },
});
```

Now, we can register an indexing function for the `ChainlinkOracleUpdate:block` event. This example reads the latest price from the Chainlink oracle contract and inserts a row into the `priceTimeline` table.

```ts [src/index.ts]
import { ponder } from "ponder:registry";
import { priceTimeline } from "ponder:schema";
import { ChainlinkOracleAbi } from "../abis/ChainlinkOracle.ts";

ponder.on("ChainlinkOracleUpdate:block", async ({ event, context }) => {
  // Fetch the price at the current block height (1000, 1010, 1020, etc.)
  const latestPrice = await context.client.readContract({
    abi: ChainlinkOracleAbi,
    address: "0xD10aBbC76679a20055E167BB80A24ac851b37056",
    functionName: "latestAnswer",
  });

  // Insert a row into the price timeline table
  await context.db.insert(priceTimeline).values({
    id: event.id,
    timestamp: event.block.timestamp,
    price: latestPrice,
  });
});
```

## Name

Every block interval must have a name, provided as a key to the `blocks` object. The name must be unique across `blocks`, `contracts`, and `accounts`.

Use a descriptive name to indicate the purpose of the block interval.

```ts [ponder.config.ts]
import { createConfig } from "ponder";

export default createConfig({
  chains: { /* ... */ },
  blocks: {
    ChainlinkOracleUpdate: { // [!code focus]
      chain: "mainnet",
      interval: 10,
      startBlock: 19783636,
    },
  },
});
```

## Interval

Use the `interval` option to specify how often the indexing function should run. A block interval with a start block of `100` and an interval of `10` will index blocks `100`, `110`, `120`, `130`, and so on.

### Block time

It's often easier to think about a _time_ interval instead of a _block_ interval. To convert between the two, divide the time interval by the chain's average block time.

For example, if the block time is 3 seconds and you want to run an indexing function once per day:

```ts
// 24 hours per day, 60 minutes per hour, 60 seconds per minute
const secondsInterval = 24 * 60 * 60;
// 3 seconds per block
const blockTime = 3;
// 28800 blocks per day
const blockInterval = secondsInterval / blockTime;
```

To find the block time of a specific chain, check the chain's documentation website or block explorer. Most Etherscan deployments have a [`/chart/blocktime`](https://polygonscan.com/chart/blocktime) page.

## Chain

The `chain` option for block intervals works the same way as it does for contracts. You can specify a different `interval`, `startBlock` and `endBlock` for each chain.

```ts [ponder.config.ts]
import { createConfig } from "ponder";

export default createConfig({
  chains: { /* ... */ },
  blocks: {
    PointsAggregation: {
      chain: {
        mainnet: {
          startBlock: 19783636, // [!code focus]
          interval: (60 * 60) / 12, // Every 60 minutes (12s block time) // [!code focus]
        }, 
        optimism: { 
          startBlock: 119534316, // [!code focus]
          interval: (60 * 60) / 2, // Every 60 minutes (2s block time) // [!code focus]
        },
      },
    },
  },
});
```

[Read more](/docs/config/contracts#chain) in the contracts guide.

## Block range

The `startBlock` and `endBlock` options for block intervals work the same way as they do for contracts.

[Read more](/docs/config/contracts#block-range) in the contracts guide.
# Tables [Define database tables and columns]

Ponder's schema definition API is built on [Drizzle](https://orm.drizzle.team/), a modern TypeScript ORM. To define a table, use the `onchainTable` function and include column definitions.

```ts [ponder.schema.ts]
import { onchainTable } from "ponder";

export const pets = onchainTable("pets", (t) => ({
  name: t.text().primaryKey(),
  age: t.integer().notNull(),
}));
```

Each table _must_ be a named export from the `ponder.schema.ts` file. The build step ignores tables that are not exported.

## Column types

The schema definition API supports most PostgreSQL data types – here's a quick reference for the most common options. Read the [Drizzle documentation](https://orm.drizzle.team/docs/column-types/pg) for a complete list.

| name             | description                        | TypeScript type          | SQL data type     |
| :--------------- | :--------------------------------- | :----------------------- | :---------------- |
| `text{:ts}`      | UTF‐8 character sequence           | `string`                 | `TEXT{:sql}`      |
| `integer{:ts}`   | Signed 4‐byte integer              | `number`                 | `INTEGER{:sql}`   |
| `real{:ts}`      | Signed 4-byte floating‐point value | `number`                 | `REAL{:sql}`      |
| `boolean{:ts}`   | `true` or `false`                  | `boolean`                | `BOOLEAN{:sql}`   |
| `timestamp{:ts}` | Date and time value (no time zone) | `Date`                   | `TIMESTAMP{:sql}` |
| `json{:ts}`      | JSON object                        | `any` or [custom](#json) | `JSON{:sql}`      |

Ponder also includes a few extra column types built specifically for EVM indexing.

| name          | description                                  | TypeScript type | SQL data type         |
| :------------ | :------------------------------------------- | :-------------- | :-------------------- |
| `bigint{:ts}` | Large integer (holds `uint256` and `int256`) | `bigint`        | `NUMERIC(78,0){:sql}` |
| `hex{:ts}`    | UTF‐8 character sequence with `0x` prefix    | `0x${string}`   | `TEXT{:sql}`          |

### `bigint`

Use the `bigint` column type to store EVM `uint256` or `int256` values.

```ts [ponder.schema.ts]
import { onchainTable } from "ponder";

export const accounts = onchainTable("accounts", (t) => ({
  address: t.hex().primaryKey(),
  balance: t.bigint().notNull(), // [!code focus]
}));
```

:::info
  Ponder's `bigint` type takes precedence over the Drizzle
  [`bigint`](https://orm.drizzle.team/docs/column-types/pg#bigint) type, which
  is an 8-byte integer (too small for EVM integer values). To
  create an 8-byte integer column, use the `int8` alias.
:::

### `hex`

Use the `hex` column type to store EVM `address`, `bytes`, or any other hex-encoded value.

```ts [ponder.schema.ts]
import { onchainTable } from "ponder";

export const accounts = onchainTable("accounts", (t) => ({
  address: t.hex().primaryKey(), // [!code focus]
  balance: t.bigint().notNull(), 
}));
```

## Enums

To define an enum, use the `onchainEnum` function. Then, use the value returned by `onchainEnum` as a column type. Under the hood, `onchainEnum` creates a PostgreSQL [enumerated type](https://www.postgresql.org/docs/current/datatype-enum.html).

```ts [ponder.schema.ts]
import { onchainEnum, onchainTable } from "ponder"; // [!code focus]

export const color = onchainEnum("color", ["ORANGE", "BLACK"]); // [!code focus]

export const cats = onchainTable("cats", (t) => ({
  name: t.text().primaryKey(),
  color: color("color"), // [!code focus]
}));
```

## Arrays

To define an array column, use the `.array(){:ts}` modifier. Arrays are a good fit for small one-dimensional collections. Don't use arrays for [relationships](/docs/schema/relations) between records.

```ts [ponder.schema.ts]
import { onchainTable } from "ponder";

export const cats = onchainTable("cats", (t) => ({
  name: t.text().primaryKey(),
  vaccinations: t.text().array(), // ["rabies", "distemper", "parvo"] // [!code focus]
}));
```

## Not null

To mark a column as not null, use the `.notNull(){:ts}` modifier. If you attempt to insert a row that does not include a value for a `NOT NULL{:sql}` column, the database will throw an error.

```ts [ponder.schema.ts]
import { onchainTable } from "ponder";

export const cats = onchainTable("cats", (t) => ({
  name: t.text().primaryKey(),
  age: t.integer().notNull(), // [!code focus]
}));
```

## Default value

To set a default value for a column, use the `.default(){:ts}` modifier and pass a string, number, boolean, or `null`.

```ts [ponder.schema.ts]
import { onchainTable } from "ponder";

export const cats = onchainTable("cats", (t) => ({
  name: t.text().primaryKey(),
  livesRemaining: t.integer().default(9), // [!code focus]
}));
```

Alternatively, use the `.$default(){:ts}` modifier to specify a JavaScript function that returns the default value. With this approach, the database driver calls the function to generate a default value for each row dynamically.

```ts [ponder.schema.ts]
import { onchainTable } from "ponder";
import { generateId } from "../utils"; // [!code focus]

export const cats = onchainTable("cats", (t) => ({
  name: t.text().primaryKey(),
  age: t.integer().$default(() => generateId()), // [!code focus]
}));
```

## Primary key

Every table **must** have a primary key. To define a primary key on a single column, use the `.primaryKey(){:ts}` modifier.

```ts [ponder.schema.ts]
import { onchainTable } from "ponder";

export const tokens = onchainTable("tokens", (t) => ({
  id: t.bigint().primaryKey(), // [!code focus]
}));
```

### Composite primary key

To create a composite primary key, use the `primaryKey()` function exported by `ponder`. Each column that forms the primary key must be not null. [Read more](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-PRIMARY-KEYS) about composite primary keys.

```ts [ponder.schema.ts]
import { onchainTable, primaryKey } from "ponder"; // [!code focus]

export const poolStates = onchainTable(
  "pool_states",
  (t) => ({
    poolId: t.bigint().notNull(),
    address: t.hex().notNull(),
    balance: t.bigint().notNull(),
  }),
  (table) => ({ // [!code focus]
    pk: primaryKey({ columns: [table.poolId, table.address] }), // [!code focus]
  }) // [!code focus]
);
```

## Indexes

To create a database index, use the `index(){:ts}` function. This example defines B-tree indexes on the `persons.name` column to support search queries, and on the `dogs.ownerId` column to support the `persons.dogs` relational query.

```ts [ponder.schema.ts]
import { onchainTable, relations, index } from "ponder";

export const persons = onchainTable(
  "persons",
  (t) => ({
    id: t.text().primaryKey(),
    name: t.text(),
  }),
  (table) => ({
    nameIdx: index().on(table.name),
  })
);

export const personsRelations = relations(persons, ({ many }) => ({
  dogs: many(dogs),
}));

export const dogs = onchainTable(
  "dogs",
  (t) => ({
    id: t.text().primaryKey(),
    ownerId: t.text().notNull(),
  }),
  (table) => ({
    ownerIdx: index().on(table.ownerId),
  })
);

export const dogsRelations = relations(dogs, ({ one }) => ({
  owner: one(persons, { fields: [dogs.ownerId], references: [persons.id] }),
}));
```

The `index(){:ts}` function supports specifying multiple columns, ordering, and custom index types like GIN and GIST. Read more in the [Drizzle](https://orm.drizzle.team/docs/indexes-constraints#indexes) and [PostgreSQL](https://www.postgresql.org/docs/current/indexes.html) documentation.

:::info
  To improve performance, the indexing engine creates database indexes _after_ the backfill is complete, just before the app becomes healthy.
:::

## Best practices

### Primary keys

Select a primary key that matches the access pattern of your indexing logic. If a table has two or more columns that together form a unique identifier for a row, use a composite primary key – don't use a concatenated string.

```ts [ponder.schema.ts]
import { onchainTable, primaryKey } from "ponder";

// ❌ Don't concatenate strings to form a primary key  [!code focus]
export const allowances = onchainTable("allowances", (t) => ({
  id: t.string().primaryKey(), // `${owner}_${spender}` // [!code focus]
  owner: t.hex(),
  spender: t.hex(),
  amount: t.bigint(),
}));

// ✅ Use a composite primary key  // [!code focus]
export const allowances = onchainTable(
  "allowances",
  (t) => ({
    owner: t.hex(),
    spender: t.hex(),
    amount: t.bigint(),
  }),
  (table) => ({ pk: primaryKey({ columns: [table.owner, table.spender] }) })  // [!code focus]
);
```

### Timestamps

Use the `bigint` column type to store block timestamps using their EVM-native Unix timestamp representation. This maintains consistency with Viem's approach, and avoids error-prone timezone manipulation code.

```ts [ponder.schema.ts]
import { onchainTable } from "ponder";

export const events = onchainTable("events", (t) => ({
  id: t.text().primaryKey(),
  timestamp: t.bigint(), // Unix timestamp in seconds [!code focus]
}));
```

If you strongly prefer working with JavaScript `Date` objects, you can also use the `timestamp` column type, but we recommend doing this conversion in the view layer.

```ts [ponder.schema.ts]
import { onchainTable } from "ponder";

export const events = onchainTable("events", (t) => ({
  id: t.text().primaryKey(),
  timestamp: t.timestamp(), // JavaScript Date object [!code focus]
}));
```

### Custom types

Use the `.$type()` modifier to customize the TypeScript type for a column. Note that the `.$type()` modifier does not validate data at runtime or in the database, it only enforces a TypeScript type.

```ts [ponder.schema.ts]
import { onchainTable } from "ponder";

export const tokens = onchainTable("tokens", (t) => ({
  id: t.bigint().primaryKey(),
  metadata: t.json().$type<{ name: string; symbol: string; decimals: number }>(), // [!code focus]
}));
```

### `camelCase` vs `snake_case`

Use `camelCase` for TypeScript names and `snake_case` for SQL names. This guideline applies to all database objects and properties, including tables, columns, relations, and indexes.

```ts [ponder.schema.ts]
import { onchainTable } from "ponder";

export const registrationEvents = onchainTable(
  "registration_events", // Use snake_case for the SQL table name
  (t) => ({
    createdAt: t.bigint(), // Drizzle automatically converts this to `created_at`
    invitedBy: t.text("invited_by"), // Avoid manual case conversion for columns
    // ...
  })
);
```

## Examples

### ERC20

Here's a schema for a simple ERC20 app.

```ts [ponder.schema.ts]
import { index, onchainTable, primaryKey } from "ponder";

export const account = onchainTable("account", (t) => ({
  address: t.hex().primaryKey(),
  balance: t.bigint().notNull(),
  isOwner: t.boolean().notNull(),
}));

export const allowance = onchainTable(
  "allowance",
  (t) => ({
    owner: t.hex(),
    spender: t.hex(),
    amount: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.owner, table.spender] }),
  })
);

export const transferEvent = onchainTable(
  "transfer_event",
  (t) => ({
    id: t.text().primaryKey(),
    amount: t.bigint().notNull(),
    timestamp: t.integer().notNull(),
    from: t.hex().notNull(),
    to: t.hex().notNull(),
  }),
  (table) => ({
    fromIdx: index().on(table.from),
  })
);

export const approvalEvent = onchainTable("approval_event", (t) => ({
  id: t.text().primaryKey(),
  amount: t.bigint().notNull(),
  timestamp: t.integer().notNull(),
  owner: t.hex().notNull(),
  spender: t.hex().notNull(),
}));
```


# Relations [Define relationships between database tables]

Ponder uses [Drizzle Relations](https://orm.drizzle.team/docs/relations) to define relationships between tables. This guide describes each kind of relationship and how to use them.

:::info
  Relations *only* enrich the GraphQL API and Drizzle Query API (`findMany` and `findFirst`). They **do not** create foreign key constraints, and won't stop you from inserting rows that violate referential integrity.
:::

## One-to-one

Use the `relations` function exported by `ponder` to define the relationships for a table.

To define a one-to-one relationship, use the `one()` operator and specify which columns relate the two tables. In this example, each user has a profile and each profile belongs to one user.

```ts [ponder.schema.ts]
import { onchainTable, relations } from "ponder"; // [!code focus]

export const users = onchainTable("users", (t) => ({
  id: t.text().primaryKey(),
}));

export const usersRelations = relations(users, ({ one }) => ({ // [!code focus]
  profile: one(profiles, { fields: [users.id], references: [profiles.userId] }), // [!code focus]
})); // [!code focus]

export const profiles = onchainTable("profiles", (t) => ({
  id: t.text().primaryKey(),
  userId: t.text().notNull(),
  age: t.integer().notNull(),
}));
```

Now that you've defined the relationship, the `profile` field will become available in the Query API (`findMany` and `findFirst`) using the `with` option.

```ts [src/index.ts]
import { users, profiles } from "ponder:schema";

await db.insert(users).values({ id: "hunter42" });
await db.insert(profiles).values({ userId: "hunter42", age: 29 });

const user = await db.sql.query.users.findFirst({
  where: eq(users.id, "hunter42"),
  with: { profile: true },
});

console.log(user.profile.age);
//          ^? { id: string; profile: { id: string; userId: string; age: number } }
```

## One-to-many

To define a one-to-many relationship, use the `one()` and `many()` operators to define both sides of the relationship. In this example, each dog has one owner and each person can own many dogs.

```ts [ponder.schema.ts]
import { onchainTable, relations } from "ponder"; // [!code focus]

export const persons = onchainTable("persons", (t) => ({
  name: t.text().primaryKey(),
}));

export const personsRelations = relations(persons, ({ many }) => ({ // [!code focus]
  dogs: many(dogs), // [!code focus]
})); // [!code focus]

export const dogs = onchainTable("dogs", (t) => ({
  petId: t.text().primaryKey(),
  ownerName: t.text().notNull(),
}));

export const dogsRelations = relations(dogs, ({ one }) => ({ // [!code focus]
  owner: one(persons, { fields: [dogs.ownerName], references: [persons.name] }), // [!code focus]
})); // [!code focus]
```

Now, any row inserted into the `dogs` table with `ownerName: "Bob"` will become available in Bob's `dogs` field.

```ts [src/index.ts]
import { persons, dogs } from "ponder:schema";

await db.insert(persons).values({ name: "Bob" });
await db.insert(dogs).values([
  { petId: "Chip", ownerName: "Bob" },
  { petId: "Spike", ownerName: "Bob" },
]);

const bob = await db.sql.query.persons.findFirst({
  where: eq(persons.id, "Bob"),
  with: { dogs: true },
});

console.log(bob.dogs);
//          ^? { name: string; dogs: { petId: string; age: number }[] }
```

:::info
  Note that in a one-to-many relationship, you cannot directly set the value of
  the `many` field. Instead, you must insert or update the related rows
  individually.
:::

## Many-to-many

To define a many-to-many relationship, create a "join table" that relates the two tables you want to connect using two one-to-many relationships.

```ts [ponder.schema.ts]
import { onchainTable, relations, primaryKey } from "ponder";

export const users = onchainTable("users", (t) => ({
  id: t.text().primaryKey(),
}));

export const usersRelations = relations(users, ({ many }) => ({
  userTeams: many(userTeams),
}));

export const teams = onchainTable("teams", (t) => ({
  id: t.text().primaryKey(),
  mascot: t.text().notNull(),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  userTeams: many(userTeams),
}));

export const userTeams = onchainTable(
  "user_teams",
  (t) => ({
    userId: t.text().notNull(),
    teamId: t.text().notNull(),
  }),
  // A composite primary key is often a good choice for a join table.
  (table) => ({ pk: primaryKey({ columns: [table.userId, table.teamId] }) })
);

export const userTeamsRelations = relations(userTeams, ({ one }) => ({
  user: one(users, { fields: [userTeams.userId], references: [users.id] }),
  team: one(teams, { fields: [userTeams.teamId], references: [teams.id] }),
}));
```

Each row in the `userTeams` table represents a relationship between a `user` and `team` row. You can query for the relationship by nesting the `with` option in the Query API.

```ts [src/index.ts]
import { users, teams, userTeams } from "ponder:schema";

await db.insert(users).values([
  { id: "ron" }, { id: "harry" }, { id: "hermione" }
]);
await db.insert(teams).values([
  { id: "muggle", mascot: "dudley" },
  { id: "wizard", mascot: "hagrid" },
]);
await db.insert(userTeams).values([
  { userId: "ron", teamId: "wizard" },
  { userId: "harry", teamId: "wizard" },
  { userId: "hermione", teamId: "muggle" },
  { userId: "hermione", teamId: "wizard" },
]);

const hermione = await db.sql.query.users.findFirst({
  where: eq(users.id, "hermione"),
  with: { userTeams: { with: { team: true } } },
});

console.log(hermione.userTeams);
//          ^? {
//            id: string;
//            userTeams: {
//              userId: string;
//              teamId: string;
//              team: {
//                id: string;
//                mascot: string
//              }
//            }[]
//          }
```

## GraphQL API

Every relationship you define in `ponder.schema.ts` automatically becomes available in the GraphQL API, with `one` relations creating singular fields and `many` relations creating plural/connection fields.

The [one-to-many example](#one-to-many) above corresponds to the following GraphQL query and result.

<div className="code-columns">

```graphql [Query]
query {
  person(id: "Bob") {
    id
    dogs {
      id
    }
  }
}
```

```json [Result]
{
  "person": {
    "id": "Bob",
    "dogs": [
      { "id": "Chip" },
      { "id": "Spike" }
    ]
  }
}
```

</div>

# Custom views [Define custom database views over onchain data]

Ponder supports custom [PostgreSQL views](https://www.postgresql.org/docs/current/tutorial-views.html) defined using Drizzle.

:::info
Custom views are not to be confused with the **views schema** pattern, an advanced feature that enables direct SQL queries. [Read more](/docs/production/self-hosting#views-pattern) about the views schema pattern in the self-hosting guide.
:::

## Usage

To define a view, use the `onchainView` function and write a query using Drizzle that references other tables or views in `ponder.schema.ts`.

```ts [ponder.schema.ts]
import { onchainTable, onchainView, count } from "ponder";

export const pets = onchainTable("pets", (t) => ({
  id: t.text().primaryKey(),
  name: t.text().notNull(),
  owner: t.text().notNull(),
}));

export const petLeaderboard = onchainView("pet_leaderboard").as((qb) =>
  qb
    .select({
      ownerName: pets.owner,
      petCount: count().as("pet_count"),
    })
    .from(pets)
    .groupBy(pets.owner)
);
```

Each view _must_ be a named export from the `ponder.schema.ts` file. The build step ignores views that are not exported.

## When to use custom views

Custom views are particularly useful in two common scenarios.

1. **Customize the GraphQL API**. With views, you can add custom fields to the GraphQL API without adding and populating an entire table.
2. **Move data processing from indexing-time to query-time**. By moving transformation logic to the query layer, views can simplify the project as a whole and help speed up lengthy backfills.

## Limitations

Custom views do not have a primary key constraint, which leads to several important limitations.

1. **Store API disabled**. The indexing function store API cannot access custom views. However, you can query custom views within indexing functions using raw SQL.
2. **No GraphQL singular query fields**. The GraphQL API does not include singular query fields for custom views.
3. **No GraphQL cursor pagination**. The GraphQL API includes plural query fields for custom views that support offset pagination, but do not support cursor pagination.

## Performance

Custom views are a useful tool to simplify indexing logic and provide a richer schema, but they are not magic. Each query against a custom view re-executes the stored `SELECT` statement.

To avoid performance issues, be sure to check the query plan for each custom view query and add database indexes on the underlying tables as appropriate.

## Examples

Here's an example of an `hourlyBucket` view from an ERC20 indexer which uses a `GROUP BY` query to aggregate transfer volumes over a time interval.

```ts [ponder.schema.ts]
import { onchainTable, onchainView, index, sql, sum, count } from "ponder";

export const transferEvent = onchainTable("transfer_event", (t) => ({
  id: t.text().primaryKey(),
  amount: t.bigint().notNull(),
  timestamp: t.integer().notNull(),
  from: t.hex().notNull(),
  to: t.hex().notNull(),
}));

export const hourlyBucket = onchainView("hourly_bucket").as((qb) =>
  qb
    .select({
      hour: sql`FLOOR(${transferEvent.timestamp} / 3600) * 3600`.as("hour"),
      totalVolume: sum(transferEvent.amount).as("total_volume"),
      transferCount: count().as("transfer_count"),
    })
    .from(transferEvent)
    .groupBy(sql`FLOOR(${transferEvent.timestamp} / 3600)`)
);
```
import { Callout } from "vocs/components";

# Indexing [Write indexing functions that populate the database]

An indexing function is a TypeScript function that's triggered by onchain activity (an event log, call trace, transaction, transfer, or block).

The purpose of indexing functions is to transform onchain data and insert it into the tables you've defined in `ponder.schema.ts`.

## Register an indexing function

To register an indexing function, use `ponder.on(...)`. The first argument is the event name, and the second argument is the function / callback that the indexing engine runs to process the event.

```ts [src/index.ts]
import { ponder } from "ponder:registry"; // [!code focus]

ponder.on("Blitmap:MetadataChanged", async ({ event, context }) => { // [!code focus]
  await context.db
    .insert(tokens)
    .values({
      id: event.args.tokenId,
      metadata: event.args.newMetadata,
    })
    .onConflictDoUpdate({
      metadata: event.args.newMetadata,
    });
}); // [!code focus]
```

Read more about how to [write to the database](/docs/indexing/write) and [read contract data](/docs/indexing/read-contracts) within indexing functions.

## Frequently asked questions

### Ordering

For each chain, the indexing engine calls indexing functions according to EVM execution order (block number, transaction index, log index). [Read more](/docs/api-reference/ponder/config#ordering) about the ordering guarantee across multiple chains, which is more complex. 

### Reorgs

The indexing engine handles reorgs automatically. You do not need to adjust your indexing function logic to handle them. Here's how it works.

- The indexing engine records all changes (insert, update, delete) to each table defined in `ponder.schema.ts` using a trigger-based [transaction log](https://en.wikipedia.org/wiki/Transaction_log).
- When the indexing engine detects a reorg, it follows these steps to reconcile the database state with the new canonical chain.
  1. Evict all non-canonical data from the RPC cache.
  2. Roll back the database to the common ancestor block height using the transaction log.
  3. Fetch the new canonical data from the RPC / remote chain.
  4. Run indexing functions to process the new canonical data.
- The indexing engine periodically drops finalized data from the transaction log to avoid database bloat.

### Crash recovery

If the process crashes and starts back up again using the same exact configuration, the indexing engine attempts a crash recovery. This process is similar to reorg reconciliation, except all unfinalized changes (the entire transaction log) are rolled back. Then, indexing resumes from the finalized block.

### Backfill vs. live indexing

Internally, the indexing engine has two distinct modes – **backfill** and **live** indexing – which use different approaches for fetching data from the RPC.

However, indexing function logic works the same way in both modes. As long as the logic is compatible with the expected onchain activity, indexing will work fine in both modes.

# Write to the database [Insert, update, and delete rows]

There are two ways to write to the database in a Ponder app.

1. **Store API**: The recommended way to write to the database. 100-1000x faster than raw SQL.
2. **Raw SQL**: A useful escape hatch for logic that's too complex for the Store API.

## Store API

The Store API is a SQL-like query builder optimized for common indexing workloads.

:::info
  During the backfill, Store API operations run **in-memory** and rows are flushed to the database periodically using efficient `COPY` statements.
:::

The examples below use this `ponder.schema.ts` to demonstrate the core concepts.

```ts [ponder.schema.ts]
import { onchainTable, primaryKey } from "ponder";
 
export const accounts = onchainTable("accounts", (t) => ({
  address: t.hex().primaryKey(),
  balance: t.bigint().notNull(),
  nickname: t.text(),
}));
 
export const allowances = onchainTable(
  "allowances",
  (t) => ({
    owner: t.hex().notNull(),
    spender: t.hex().notNull(),
    value: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.owner, table.spender] }),
  })
);
```

### Insert

Insert one or many rows into the database. Returns the inserted rows, **including** any default values that were generated.

```ts [src/index.ts]
import { accounts } from "ponder:schema";

// Insert a single row
const row = await db.insert(accounts).values({
  address: "0x7Df1", 
  balance: 0n
});

// Insert multiple rows
const rows = await db.insert(accounts).values([
  { address: "0x7Df2", balance: -50n },
  { address: "0x7Df3", balance: 100n },
]);
```

#### Errors

If you insert a row that's missing a required column value (not null constraint violation), `insert` will reject with an error.

```ts [src/index.ts]
import { accounts } from "ponder:schema";
 
const row = await db.insert(accounts).values({
  address: "0x7Df1",
});

// Error: Column "balance" is required but not present in the values object.
```

If you insert a duplicate row (unique constraint violation), `insert` will reject with an error.

```ts [src/index.ts]
import { accounts } from "ponder:schema";
 
const row = await db.insert(accounts).values({
  address: "0x7Df1",
});

// Error: Column "balance" is required but not present in the values object.
```

Use [conflict resolution](#conflict-resolution) to ignore unique constraint violations with `onConflictDoNothing` or achieve upsert behavior with `onConflictDoUpdate`.

### Find

Find a single row by primary key. Returns the row, or `null` if not found.

The second argument is an object that specifies the primary key value to search for.

```ts [src/index.ts]
import { accounts } from "ponder:schema";

const row = await db.find(accounts, { address: "0x7Df1" });
```

If the table has a composite primary key, the object must include a value for each column in the primary key.

```ts [src/index.ts]
import { allowances } from "ponder:schema";

const row = await db.find(allowances, {
  owner: "0x7Df1",
  spender: "0x7Df2"
});
```

### Update

Update a row by primary key. Returns the updated row.

```ts [src/index.ts]
import { accounts } from "ponder:schema";

const row = await db
  .update(accounts, { address: "0x7Df1" })
  .set({ balance: 100n });
```

You can also pass a function to `set`, which receives the existing row and returns the update object.

```ts [src/index.ts]
import { accounts } from "ponder:schema";

const row = await db
  .update(accounts, { address: "0x7Df1" })
  .set((row) => ({ balance: row.balance + 100n })); // [!code focus]
```

#### Errors

If the target row is not found, `update` will reject with an error.

```ts [src/index.ts]
import { tokens } from "ponder:schema";

const row = await db
  .update(accounts, { address: "0xa4F0" })
  .set({ balance: 200n });

// Error: No row found for address "0xa4F0".
```

If the new row violates a not null constraint, `update` will reject with an error.

```ts [src/index.ts]
import { tokens } from "ponder:schema";

const row = await db
  .update(accounts, { address: "0x7Df1" })
  .set({ balance: null });

// Error: Column "balance" is required but not present in the object.
```

### Delete

Delete a row by primary key. Returns `true` if the row was deleted, or `false` if not found.

```ts [src/index.ts]
import { accounts } from "ponder:schema";

const deleted = await db.delete(accounts, { address: "0x7Df1" });
```

### Conflict resolution

The `insert` method supports conflict resolution. 

#### `onConflictDoNothing`

Use `onConflictDoNothing` to skip the insert if the specified row already exists. This avoids unique constraint violation errors.

```ts [src/index.ts]
import { accounts } from "ponder:schema";

const row = await db
  .insert(accounts)
  .values({ address: "0x7Df1", balance: 0n })
  .onConflictDoNothing(); // [!code focus]
```

#### `onConflictDoUpdate`

Use `onConflictDoUpdate` to achieve "upsert" behavior.

If the row does not exist, it will be inserted using the specified `values`. Otherwise, the existing row will be updated with the values passed to `onConflictDoUpdate`.

```ts [src/index.ts]
import { accounts } from "ponder:schema";

const row = await db
  .insert(accounts)
  .values({ address: "0x7Df1", balance: 0n })
  .onConflictDoUpdate({ value: 200n }); // [!code focus]
```

Just like with `update`, you can pass a function to `onConflictDoUpdate` that receives the existing row and returns the update object.

```ts [src/index.ts]
import { accounts } from "ponder:schema";

const row = await db
  .insert(accounts)
  .values({ address: "0x7Df1", balance: 0n })
  .onConflictDoUpdate((row) => ({ // [!code focus]
    balance: row.balance + 50n // [!code focus]
  })); // [!code focus]
```

## Raw SQL

:::warning
  Raw SQL queries are **much slower** than the store API. Only use raw SQL when you need complex queries that aren't possible with the store API.
:::

### Query builder

Use `db.sql` to access the raw Drizzle PostgreSQL query builder. This is useful for complex queries that join multiple tables or use advanced SQL features.

```ts [src/index.ts]
import { accounts, tradeEvents } from "ponder:schema";
import { eq, and, gte, inArray, sql } from "drizzle-orm";

// Add 100 points to accounts with recent trades
await db.sql
  .update(accounts)
  .set({ points: sql`${accounts.points} + 100` })
  .where(
    inArray(
      accounts.address,
      db.sql
        .select({ address: tradeEvents.from })
        .from(tradeEvents)
        .where(
          gte(tradeEvents.timestamp, event.block.timestamp - 24 * 60 * 60)
        )
    )
  );
```

### Relational queries

Use `db.sql.query` to access Drizzle's relational query builder. This provides a type-safe way to write complex `SELECT` queries that join multiple tables.

```ts [src/index.ts]
import { accounts, tradeEvents } from "ponder:schema";

// Find recent large trades with account details
const trades = await db.sql.query.tradeEvents.findMany({
  where: (table, { gt, gte, and }) =>
    and(
      gt(table.amount, 1_000n),
      gte(table.timestamp, Date.now() - 1000 * 60 * 60)
    ),
  limit: 10,
  with: { account: true },
});
```

Visit the [Drizzle documentation](https://orm.drizzle.team/docs/rqb) for more details on writing raw SQL queries.
# Read contract data [Call read-only functions directly]

Sometimes, indexing function _triggers_ (event logs, traces, etc.) do not contain all of the onchain data you need to build your application. It's often useful to call read-only contract functions, fetch transaction receipts, or simulate contract interactions.

Ponder natively supports this pattern through a custom [Viem Client](https://viem.sh/docs/clients/intro) that includes performance & usability improvements specific to indexing.

## Basic example

To read data from a contract, use `context.client.readContract()` and include the contract address and ABI from `context.contracts`.

:::code-group

```ts [ponder.config.ts]
import { createConfig } from "ponder";
import { BlitmapAbi } from "./abis/Blitmap";

export default createConfig({
  chains: {
    mainnet: { id: 1, rpc: process.env.PONDER_RPC_URL_1 },
  },
  contracts: {
    Blitmap: {
      chain: "mainnet",
      abi: BlitmapAbi,
      address: "0x8d04...D3Ff63",
      startBlock: 12439123,
    },
  },
});
```

```ts [src/index.ts]
import { ponder } from "ponder:registry";
import { tokens } from "ponder:schema";

ponder.on("Blitmap:Mint", async ({ event, context }) => {
  const { client } = context;
  //      ^? ReadonlyClient<"mainnet">
  const { Blitmap } = context.contracts;
  //      ^? {
  //           abi: [...]
  //           address: "0x8d04...D3Ff63",
  //         }

  // Fetch the URI for the newly minted token.
  const tokenUri = await client.readContract({
    abi: Blitmap.abi,
    address: Blitmap.address,
    functionName: "tokenURI",
    args: [event.args.tokenId],
  });

  // Insert a Token record, including the URI.
  await context.db.insert(tokens).values({
    id: event.args.tokenId,
    uri: tokenUri,
  });
});
```

:::

## Client

The `context.client` object is a custom [Viem Client](https://viem.sh/docs/clients/intro) that caches RPC responses.

```ts [src/index.ts]
import { ponder } from "ponder:registry";

ponder.on("Blitmap:Mint", async ({ event, context }) => {
  const tokenUri = await context.client.readContract({
    abi: context.contracts.Blitmap.abi,
    address: context.contracts.Blitmap.address,
    method: "tokenUri",
    args: [event.args.tokenId],
  });
});
```

:::warning
  **_Do not manually set up a Viem Client._** If `context.client` is not working
  for you, please open a GitHub issue or send a message to the chat. We'd like
  to understand and accommodate your workflow.

  ```ts [src/index.ts]
  import { ponder } from "ponder:registry";
  import { createPublicClient, http } from "viem";

  // Don't do this! ❌ ❌ ❌
  const publicClient = createPublicClient({
    transport: http("https://eth-mainnet.g.alchemy.com/v2/..."),
  });

  ponder.on("Blitmap:Mint", async ({ event, context }) => {
    const tokenUri = await publicClient.readContract({
      abi: context.contracts.Blitmap.abi,
      address: context.contracts.Blitmap.address,
      method: "tokenUri",
      args: [event.args.tokenId],
    });
  });
  ```
:::

### Supported actions

The `context.client` object supports most Viem actions.

| name                        | description                                                                                         | Viem docs                                                                                      |
| :-------------------------- | :-------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| readContract                | Returns the result of a read-only function on a contract.                                           | [readContract](https://viem.sh/docs/contract/readContract)                                     |
| multicall                   | Similar to readContract, but batches requests.                                                      | [multicall](https://viem.sh/docs/contract/multicall)                                           |
| simulateContract            | Simulates & validates a contract interaction.                                                       | [simulateContract](https://viem.sh/docs/contract/simulateContract)                             |
| getBalance                  | Returns the balance of an address in wei.                                                           | [getBalance](https://viem.sh/docs/actions/public/getBalance)                                   |
| getBytecode                 | Returns the bytecode at an address.                                                                 | [getBytecode](https://viem.sh/docs/contract/getBytecode.html)                                  |
| getStorageAt                | Returns the value from a storage slot at a given address.                                           | [getStorageAt](https://viem.sh/docs/contract/getStorageAt)                                     |
| getBlock                    | Returns information about a block at a block number, hash or tag.                                   | [getBlock](https://viem.sh/docs/actions/public/getBlock)                                       |
| getTransactionCount         | Returns the number of transactions an account has broadcast / sent.                                 | [getTransactionCount](https://viem.sh/docs/actions/public/getTransactionCount)                 |
| getBlockTransactionCount    | Returns the number of Transactions at a block number, hash or tag.                                  | [getBlockTransactionCount](https://viem.sh/docs/actions/public/getBlockTransactionCount)       |
| getTransaction              | Returns information about a transaction given a hash or block identifier.                           | [getTransaction](https://viem.sh/docs/actions/public/getTransaction)                           |
| getTransactionReceipt       | Returns the transaction receipt given a transaction hash.                                           | [getTransactionReceipt](https://viem.sh/docs/actions/public/getTransactionReceipt)             |
| getTransactionConfirmations | Returns the number of blocks passed (confirmations) since the transaction was processed on a block. | [getTransactionConfirmations](https://viem.sh/docs/actions/public/getTransactionConfirmations) |
| call                        | An Action for executing a new message call.                                                         | [call](https://viem.sh/docs/actions/public/call)                                               |
| estimateGas                 | An Action for estimating gas for a transaction.                                                     | [estimateGas](https://viem.sh/docs/actions/public/estimateGas)                                 |
| getFeeHistory               | Returns a collection of historical gas information.                                                 | [getFeeHistory](https://viem.sh/docs/actions/public/getFeeHistory)                             |
| getProof                    | Returns the account and storage values of the specified account including the Merkle-proof.         | [getProof](https://viem.sh/docs/actions/public/getProof)                                       |
| getEnsAddress               | Gets address for ENS name.                                                                          | [getEnsAddress](https://viem.sh/docs/ens/actions/getEnsAddress)                                |
| getEnsAvatar                | Gets the avatar of an ENS name.                                                                     | [getEnsAvatar](https://viem.sh/docs/ens/actions/getEnsAvatar)                                  |
| getEnsName                  | Gets primary name for specified address.                                                            | [getEnsName](https://viem.sh/docs/ens/actions/getEnsName)                                      |
| getEnsResolver              | Gets resolver for ENS name.                                                                         | [getEnsResolver](https://viem.sh/docs/ens/actions/getEnsResolver)                              |
| getEnsText                  | Gets a text record for specified ENS name.                                                          | [getEnsText](https://viem.sh/docs/ens/actions/getEnsText)                                      |

### Direct RPC requests

Use the `context.client.request` method to make direct RPC requests. This low-level approach can be useful for advanced RPC request patterns that are not supported by the actions above.

```ts [src/index.ts]
import { ponder } from "ponder:registry";

ponder.on("ENS:NewOwner", async ({ event, context }) => {
  const traces = await context.client.request({ // [!code focus]
    method: 'debug_traceTransaction', // [!code focus]
    params: [event.transaction.hash, { tracer: "callTracer" }] // [!code focus]
  }); // [!code focus]

  // ...
});
```

### Block number

By default, the `blockNumber` option is set to the block number of the current event (`event.block.number`).

```ts [src/index.ts]
import { ponder } from "ponder:registry";

ponder.on("Blitmap:Mint", async ({ event, context }) => {
  const totalSupply = await context.client.readContract({
    abi: context.contracts.Blitmap.abi,
    address: context.contracts.Blitmap.address,
    functionName: "totalSupply",
    // This is set automatically, no need to include it yourself.
    // blockNumber: event.block.number,
  });
});
```

You can also specify a `blockNumber` to read data at a specific block height. It will still be cached.

```ts [src/index.ts]
import { ponder } from "ponder:registry";

ponder.on("Blitmap:Mint", async ({ event, context }) => {
  const totalSupply = await context.client.readContract({
    abi: context.contracts.Blitmap.abi,
    address: context.contracts.Blitmap.address,
    functionName: "totalSupply",
    blockNumber: 15439123n, // [!code focus]
  });
});
```

:::info
  The `blockTag` option is not supported by custom client actions.
:::

### Caching

Most RPC requests made using `context.client` are cached in the database. When an indexing function calls a method with a specific set of arguments for the first time, it will make an RPC request. Any subsequent calls to the same method with the same arguments will be served from the cache.

See the [full list](https://github.com/ponder-sh/ponder/blob/main/packages/core/src/indexing/client.ts#L73-L121) of cache-enabled RPC methods in the source code.

## Contract addresses & ABIs

The `context.contracts` object contains each contract address and ABI you provide in `ponder.config.ts`.

### Multiple chains

If a contract is configured to run on multiple chains, `context.contracts` contains the contract addresses for whichever chain the current event is from.

:::warning
  It's not currently possible to call a contract that's on a different chain
  than the current event. If you need this feature, please open an issue or send
  a message to the chat.
:::

:::code-group

```ts [ponder.config.ts]
import { createConfig } from "ponder";
import { UniswapV3FactoryAbi } from "./abis/UniswapV3Factory";

export default createConfig({
  chains: {
    mainnet: { id: 1, rpc: process.env.PONDER_RPC_URL_1 },
    base: { id: 8453, rpc: process.env.PONDER_RPC_URL_8453 },
  },
  contracts: {
    UniswapV3Factory: {
      abi: UniswapV3FactoryAbi,
      chain: { // [!code focus]
        mainnet: { // [!code focus]
          address: "0x1F98431c8aD98523631AE4a59f267346ea31F984", // [!code focus]
          startBlock: 12369621, // [!code focus]
        }, // [!code focus]
        base: { // [!code focus]
          address: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD", // [!code focus]
          startBlock: 1371680, // [!code focus]
        }, // [!code focus]
      }, // [!code focus]
    },
  },
});
```

```ts [src/index.ts]
import { ponder } from "ponder:registry";

ponder.on("UniswapV3Factory:FeeAmountEnabled", async ({ event, context }) => {
  const tickSpacing = await context.client.readContract({
    abi: context.contracts.UniswapV3Factory.abi,
    address: context.contracts.UniswapV3Factory.address,
    functionName: "feeAmountTickSpacing",
    args: [event.args.fee],
  });
});
```

:::

### Factory contracts

The `context.contracts` object does not include an `address` property for contracts that use `factory()`. To read data from the contract that emitted the current event, use `event.log.address`.

```ts [src/index.ts]
import { ponder } from "ponder:registry";

ponder.on("SudoswapPool:Transfer", async ({ event, context }) => {
  const { SudoswapPool } = context.contracts;
  //      ^? { abi: [...] }

  const totalSupply = await context.client.readContract({
    abi: SudoswapPool.abi,
    address: event.log.address,
    functionName: "totalSupply",
  });
});
```

To call a factory contract child from an indexing function for a _different_ contract, use your application logic to determine the correct address. For example, the address might come from `event.args`.

```ts [src/index.ts]
import { ponder } from "ponder:registry";

ponder.on("LendingProtocol:RegisterPool", async ({ event, context }) => {
  const totalSupply = await context.client.readContract({
    abi: context.contracts.SudoswapPool.abi,
    address: event.args.pool,
    functionName: "totalSupply",
  });
});
```

### Read a contract without indexing it

The `context.contracts` object only contains addresses & ABIs for the contracts in `ponder.config.ts`.

To read an external contract, import the ABI object directly and include the address manually. Ad-hoc requests like this are still cached and the block number will be set automatically.

:::code-group

```ts [ponder.config.ts]
import { createConfig } from "ponder";
import { AaveTokenAbi } from "./abis/AaveToken";

export default createConfig({
  contracts: {
    AaveToken: {
      chain: "mainnet",
      abi: AaveTokenAbi,
      address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
      startBlock: 10926829,
    },
  },
});
```

```ts [src/index.ts]
import { ponder } from "ponder:registry";
import { ChainlinkPriceFeedAbi } from "../abis/ChainlinkPriceFeed";

ponder.on("AaveToken:Mint", async ({ event, context }) => {
  const priceData = await context.client.readContract({
    abi: ChainlinkPriceFeedAbi,
    address: "0x547a514d5e3769680Ce22B2361c10Ea13619e8a9",
    functionName: "latestRoundData",
  });

  const usdValue = priceData.answer * event.args.amount;
  // ...
});
```

:::

## More examples

### Zorbs gradient data

Suppose we're building an application that stores the gradient metadata of each [Zorb NFT](https://etherscan.io/address/0xca21d4228cdcc68d4e23807e5e370c07577dd152#code). Here's a snippet from the contract.

```solidity [ZorbNft.sol]
contract ZorbNft is ERC721 {

    function mint() public {
        // ...
    }

    function gradientForAddress(address user) public pure returns (bytes[5] memory) { // [!code focus]
        return ColorLib.gradientForAddress(user); // [!code focus]
    } // [!code focus]
}
```

Every Zorb has a gradient, but the contract doesn't emit gradient data in any event logs. To read the gradient data for each new Zorb, we can call the `gradientForAddress` function.

```ts filename="src/index.ts" {6-11}
import { ponder } from "ponder:registry";
import { zorbs } from "ponder:schema";

ponder.on("ZorbNft:Transfer", async ({ event, context }) => {
  if (event.args.from === ZERO_ADDRESS) {
    // If this is a mint, read gradient metadata from the contract.
    const gradientData = await context.client.readContract({
      abi: context.contracts.ZorbNft.abi,
      address: context.contracts.ZorbNft.address,
      functionName: "gradientForAddress",
      args: [event.args.to],
    });

    await context.db.insert(zorbs).values({
      id: event.args.tokenId,
      gradient: gradientData,
      ownerId: event.args.to,
    });
  } else {
    // If not a mint, just update ownership information.
    await context.db
      .update(zorbs, { id: event.args.tokenId })
      .set({ ownerId: event.args.to });
  }
});
```
import { Callout } from "vocs/components";

# Deploy on Railway [Host a Ponder app on Railway]

[Railway](https://railway.app)'s general-purpose cloud platform is a great starting point for most Ponder apps.

## Guide

::::steps

### Log in to Railway

Connect your GitHub account, and make sure that your Ponder app has been pushed to remote.

### Create a Ponder app service

From the Railway console:

1. Click **New Project** → **Deploy from GitHub repo** and select your repo from the list.
2. Click **Add variables**, then add RPC URLs (e.g. `PONDER_RPC_URL_1`) and other environment variables.
3. Create a public domain. In **Settings** → **Networking**, click **Generate Domain**.
4. Update the start command. In **Settings** → **Deploy**, set the **Custom Start Command** to include the `--schema` option. This is required to enable zero-downtime deployments. [Read more](/docs/database#database-schema).

:::code-group

```bash [pnpm]
pnpm start --schema $RAILWAY_DEPLOYMENT_ID
```

```bash [yarn]
yarn start --schema $RAILWAY_DEPLOYMENT_ID
```

```bash [npm]
npm run start -- --schema $RAILWAY_DEPLOYMENT_ID
```

:::

5. Set the healthcheck path and timeout. In **Settings** → **Deploy**, set the **Healthcheck Path** to `/ready` and the **Healthcheck Timeout** to `3600` seconds (1 hour, the maximum allowed).

:::info
_Monorepo users:_ Use the **Root Directory** and **Start Command** options
to run `ponder start` at the Ponder project root. For example, set the root directory
to `packages/ponder` or set the start command to `cd packages/ponder && pnpm start`.
:::

### Create a Postgres database

From the new project dashboard:

1. Click **Create** → **Database** → **Add PostgreSQL**
2. Open the **Variables** tab for the Ponder app service, click **New Variable** → **Add Reference** → select `DATABASE_URL` and click **Add**

::::

After a moment, the service running `ponder start` should redeploy successfully. Check the **Build Logs** and **Deploy Logs** tabs to debug any issues.
# Transaction receipts [Fetch transaction receipts]

A **transaction receipt** is an object containing the *post-execution* results of a transaction, including the price and amount of gas consumed, the revert status, the logs emitted, and more.

:::tip
In contrast, the **transaction input** only includes *pre-execution* data like the from and to addresses, input, and native transfer amount. Ponder includes transaction inputs automatically at `event.transaction`.
:::

## Guide

Ponder supports transaction receipts with the `includeTransactionReceipts` option, **or** dynamic RPC requests through `context.client`.

### Include receipts for every event

:::warning
Transaction receipts fetched using `includeTransactionReceipts` do not include the `logs` array.
:::

To fetch the transaction receipt associated with every event produced by a contract, use the `includeTransactionReceipts` option.

```ts [ponder.config.ts]
import { createConfig } from "ponder";
import { BlitmapAbi } from "./abis/Blitmap";

export default createConfig({
  contracts: {
    Blitmap: {
      abi: BlitmapAbi,
      chain: "mainnet",
      address: "0x8d04a8c79cEB0889Bdd12acdF3Fa9D207eD3Ff63",
      includeTransactionReceipts: true, // [!code focus]
      startBlock: 12439123,
    },
  },
  // ...
});
```

Once enabled, the `event.transactionReceipt` object will become available in your indexing functions.

```ts [src/index.ts]
import { ponder } from "ponder:registry";

ponder.on("Blitmap:Mint", async ({ event }) => {
  console.log(event.transactionReceipt);

  // ...
});
```

### Fetch receipts ad-hoc

If you only need the transaction receipt in special cases, or you need the `logs` array, use the `context.client.getTransactionReceipt` method within your indexing function logic.

```ts [src/index.ts]
import { ponder } from "ponder:registry";

ponder.on("Blitmap:Mint", async ({ event }) => {
  const receipt = await context.client.getTransactionReceipt({
    hash: event.transaction.hash
  });
  console.log(receipt);

  // ...
});
```
# `ponder.config.ts` [API reference]

:::tip
  This is a low-level reference. For an introduction, visit the
  different config sections: [Chains](/docs/config/chains), [Contracts](/docs/config/contracts), [Accounts](/docs/config/accounts), [Block intervals](/docs/config/block-intervals).
:::

The `ponder.config.ts` file defines chain IDs, RPC URLs, contract addresses & ABIs, and database configuration.

## File requirements

The `ponder.config.ts` file must **default export** the object returned by `createConfig`.

{/* prettier-ignore */}
```ts [ponder.config.ts] {1,4}
import { createConfig } from "ponder";

export default createConfig({
  chains: { /* ... */ },
  contracts: { /* ... */ },
});
```

By default, `ponder dev` and `start` look for `ponder.config.ts` in the current working directory. Use the `--config-file` CLI option to specify a different path.

## `createConfig`

### `database`

Here is the logic Ponder uses to determine which database to use:

- If the `database.kind` option is specified, use the specified database.
- If the `DATABASE_URL` environment variable is defined, use Postgres with that connection string.
- If `DATABASE_URL` is not defined, use PGlite.

| field    |           type           |                                          |
| :------- | :----------------------: | :--------------------------------------- |
| **kind** | `"pglite" \| "postgres"` | **Default: See above.** Database to use. |

#### PGlite

| field         |    type    |                                                                                 |
| :------------ | :--------: | :------------------------------------------------------------------------------ |
| **kind**      | `"pglite"` |                                                                                 |
| **directory** |  `string`  | **Default: `.ponder/pglite`**. Directory path to use for PGlite database files. |

```ts [ponder.config.ts] {4-7}
import { createConfig } from "ponder";

export default createConfig({
  database: {
    kind: "pglite",
    directory: "./.ponder/pglite",
  },
  // ...
});
```

#### Postgres

| field                |                        type                         |                                                                           |
| :------------------- | :-------------------------------------------------: | :------------------------------------------------------------------------ |
| **kind**             |                    `"postgres"`                     |                                                                           |
| **connectionString** |                      `string`                       | **Default: `DATABASE_URL` env var**. Postgres database connection string. |
| **poolConfig**       | [`PoolConfig`](https://node-postgres.com/apis/pool) | **Default: `{ max: 30 }`**. Pool configuration passed to `node-postgres`. |

```ts [ponder.config.ts] {4-10}
import { createConfig } from "ponder";

export default createConfig({
  database: {
    kind: "postgres",
    connectionString: "postgresql://user:password@localhost:5432/dbname",
    poolConfig: {
      max: 100,
      ssl: true,
    },
  },
  // ...
});
```

### `ordering`

Specifies how events across multiple chains should be ordered. For single-chain apps, `ordering` has no effect.

#### Usage

```ts [ponder.config.ts] {4}
import { createConfig } from "ponder";

export default createConfig({
  ordering: "multichain",
  chains: { /* ... */ },
  // ... more config
});
```

#### Parameters

| field        |             type              |                                                      |
| :----------- | :---------------------------: | :--------------------------------------------------- |
| **ordering** | `"omnichain" \| "multichain"` | **Default:** `"omnichain"`. Event ordering strategy. |

#### Guarantees

The omnichain and multichain ordering strategies offer different guarantees. Multichain ordering is generally faster, but will fail or produce a non-deterministic database state if your indexing logic attempts to access the same database row(s) from multiple chains.

|                                      | Omnichain (default)                                                         | Multichain                                                 |
| :----------------------------------- | :-------------------------------------------------------------------------- | :--------------------------------------------------------- |
| Event order for any individual chain | Deterministic, by EVM execution                                             | Deterministic, by EVM execution                            |
| Event order across chains            | Deterministic, by (block timestamp, chain ID, block number)                 | Non-deterministic, no ordering guarantee                   |
| Realtime indexing latency            | Medium-high, must wait for the slowest chain to maintain ordering guarantee | Low, each chain indexes blocks as soon as they arrive      |
| Indexing logic constraints           | None                                                                        | Must avoid cross-chain writes **or** use commutative logic |
| Use cases                            | Bridges, cross-chain contract calls, global constraints                     | Same protocol deployed to multiple chains                  |

### `chains`

An object mapping chain names to chain configuration.

:::warning
  Most Ponder apps require a paid RPC provider plan to avoid rate limits.
:::

#### Usage

```ts [ponder.config.ts]
import { createConfig } from "ponder";
import { BlitmapAbi } from "./abis/Blitmap";

export default createConfig({
  chains: { // [!code focus]
    mainnet: { // [!code focus]
      id: 1, // [!code focus]
      rpc: process.env.PONDER_RPC_URL_1, // [!code focus]
      ws: process.env.PONDER_WS_URL_1, // [!code focus]
    }, // [!code focus]
  }, // [!code focus]
  // ...
});
```

#### Parameters

| field                    |    type                            |                                                                                                                                            |
| :----------------------- | :---------------------------------:| :----------------------------------------------------------------------------------------------------------------------------------------- |
| **name**                 |  `string`                          | **Required**. A unique name for the chain. Must be unique across all chains. _Provided as the object property name._                       |
| **id**                   |  `number`                          | **Required**. The [chain ID](https://chainlist.org) for the chain.                                                                         |
| **rpc**                  |  `string \| string[] \| Transport` | **Required**. One or more RPC endpoints or a Viem [Transport](https://viem.sh/docs/clients/transports/http) e.g. `http` or `fallback`.|
| **ws**                   |  `string`                          | **Default: `undefined`**. A webSocket endpoint for realtime indexing on this chain.                                                         |
| **pollingInterval**      |  `number`                          | **Default: `1_000`**. Frequency (in ms) used when polling for new events on this chain.                                                    |
| **disableCache**         |  `boolean`                         | **Default: `false`**. Disables the RPC request cache. Use when indexing a [local node](/docs/guides/foundry) like Anvil.                   |


### `contracts`

An object mapping contract names to contract configuration. Ponder will fetch RPC data and run indexing functions according to the options you provide.

#### Usage

```ts [ponder.config.ts]
import { createConfig } from "ponder";
import { BlitmapAbi } from "./abis/Blitmap";

export default createConfig({
  contracts: { // [!code focus]
    Blitmap: { // [!code focus]
      abi: BlitmapAbi, // [!code focus]
      chain: "mainnet", // [!code focus]
      address: "0x8d04a8c79cEB0889Bdd12acdF3Fa9D207eD3Ff63", // [!code focus]
      startBlock: 12439123, // [!code focus]
    }, // [!code focus]
  }, // [!code focus]
  // ...
});
```

#### Parameters

| field                          |                  type                   |                                                                                                                                                                                                                                        |
| :----------------------------- | :-------------------------------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **name**                       |                `string`                 | **Required**. A unique name for the smart contract. Must be unique across all contracts. _Provided as the object property name._                                                                                                       |
| **abi**                        |              `abitype.Abi`              | **Required**. The contract [ABI](https://docs.soliditylang.org/en/v0.8.17/abi-spec.html) as an array as const. Must be asserted as constant, see [ABIType documentation](https://abitype.dev/guide/getting-started#usage) for details. |
| **chain**                    |        `string \| ChainConfig`        | **Required**. The name of the chain this contract is deployed to. References the `chains` field. Also supports [multiple chains](/docs/config/contracts#multiple-chains).                                                |
| **address**                    | `0x{string} \| 0x{string}[] \| Factory` | **Default: `undefined`**. One or more contract addresses or factory configuration.                                                                                                                                                     |
| **startBlock**                 |          `number \| "latest"`           | **Default: `0`**. Block number or tag to start indexing. Usually set to the contract deployment block number.                                                                                                                          |
| **endBlock**                   |          `number \| "latest"`           | **Default: `undefined`**. Block number or tag to stop indexing. If this field is specified, the contract will not be indexed in realtime. This field can be used alongside `startBlock` to index a specific block range.               |
| **filter**                     |         [`Filter`](#filter)             | **Default: `undefined`**. Event filter criteria. [Read more](/docs/config/contracts#filter-by-indexed-parameter-value).                                                                                                                               |
| **includeTransactionReceipts** |                `boolean`                | **Default: `false`**. If this field is `true`, `transactionReceipt` will be included in `event`.                                                                                                                                       |
| **includeCallTraces**          |                `boolean`                | **Default: `false`**. If this field is `true`, each function in the abi will be available as an indexing function event name. [Read more](/docs/guides/call-traces).                                            |


#### `filter`

:::tip
  The `filter` option is typically only necessary if you have not specified an
  `address`. By default, Ponder only fetches and indexes events for which you
  have registered an indexing function.
:::

The `filter` option is used to filter event logs by argument value. [Read more](/docs/config/contracts#filter-by-indexed-parameter-value) about log filters.

| field     |         type         |                                                                                                                                       |
| :-------- | :------------------: | :------------------------------------------------------------------------------------------------------------------------------------ |
| **event** | `string \| string[]` | **Required**. One or more event names present in the provided ABI.                                                                    |
| **args**  |       `object`       | **Required**. An object containing indexed argument values to filter for. Only allowed if **one** event name was provided in `event`. |

### `accounts`

An object mapping account names to account configuration. Accounts are used to index transactions or native transfers.

#### Usage

```ts [ponder.config.ts]
import { createConfig } from "ponder";

export default createConfig({
  accounts: { // [!code focus]
    coinbasePrime: { // [!code focus]
      chain: "mainnet", // [!code focus]
      address: "0xCD531Ae9EFCCE479654c4926dec5F6209531Ca7b", // [!code focus]
      startBlock: 12111233, // [!code focus]
    }, // [!code focus]
  }, // [!code focus]
  // ...
});
```

#### Parameters

| field                          |                  type                   |                                                                                                                                                                                                                         |
| :----------------------------- | :-------------------------------------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **name**                       |                `string`                 | **Required**. A unique name for the smart contract. Must be unique across all contracts. _Provided as the object property name._                                                                                        |
| **chain**                    |                `string`                 | **Required**. The name of the chain this contract is deployed to. References the `chains` field. Also supports [multiple chains](/docs/config/contracts#chain).                                 |
| **address**                    | `0x{string} \| 0x{string}[] \| Factory` | **Default: `undefined`**. One or more contract addresses or factory configuration.                                                                                                                                      |
| **startBlock**                 |                `number`                 | **Default: `0`**. Block number to start syncing events.                                                                                                                                                                 |
| **endBlock**                   |                `number`                 | **Default: `undefined`**. Block number to stop syncing events. If this field is specified, the contract will not be indexed in realtime. This field can be used alongside `startBlock` to index a specific block range. |
| **includeTransactionReceipts** |                `boolean`                | **Default: `false`**. If this field is `true`, `transactionReceipt` will be included in `event`.                                                                                                                        |


### `blocks`

An object mapping block interval names to block interval configuration.

#### Usage

```ts [ponder.config.ts]
import { createConfig } from "ponder";

export default createConfig({
  blocks: { // [!code focus]
    ChainlinkPriceOracle: { // [!code focus]
      chain: "mainnet", // [!code focus]
      startBlock: 19_750_000, // [!code focus]
      interval: 5, // [!code focus] every minute
    }, // [!code focus]
  }, // [!code focus]
  // ...
});
```

#### Parameters

| field     |                         type                         |                                                                                            |
| :-------- | :--------------------------------------------------: | :----------------------------------------------------------------------------------------- |
| **name**  |                `string`                | **Required**. A unique name for the block interval. Must be unique across all block intervals. _Provided as the object property name._ |
| **chain** |                `string`                | **Required**. The name of the chain this block interval is deployed to. References the `chains` field. Also supports [multiple chains](/docs/config/contracts#chain). |
| **startBlock** |                `number`                | **Default: `0`**. Block number to start syncing events. |
| **endBlock** |                `number`                | **Default: `undefined`**. Block number to stop syncing events. If this field is specified, the contract will not be indexed in realtime. This field can be used alongside `startBlock` to index a specific block range. |
| **interval** |                `number`                | **Default: `0`**. The interval between blocks to index. |

## `factory`

Specifies a list of addresses collected from decoded event logs. Both [`contracts`](#contracts) and [`accounts`](#accounts) support `factory()` in their `address` field. [Read more](/docs/guides/factory) in the factory pattern guide.

| field         |                         type                         |                                                                                            |
| :------------ | :--------------------------------------------------: | :----------------------------------------------------------------------------------------- |
| **address**   |             `0x{string} \| 0x{string}[]`             | **Required**. Address of the factory contract that creates instances of this contract.     |
| **event**     | [`AbiEvent`](https://abitype.dev/api/types#abievent) | **Required**. ABI item of the event that announces the creation of a new child contract.   |
| **parameter** |                       `string`                       | **Required**. Name of the parameter within `event` that contains child contract addresses. |

```ts [ponder.config.ts] {8-14}
import { createConfig, factory } from "ponder"; // [!code focus]

export default createConfig({
  contracts: {
    uniswapV2: {
      // ...
      address: factory({ // [!code focus]
        address: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f", // [!code focus]
        event: parseAbiItem( // [!code focus]
          "event PairCreated(address indexed token0, address indexed token1, address pair, uint256)" // [!code focus]
        ), // [!code focus]
        parameter: "pair", // [!code focus]
      }), // [!code focus]
    },
  },
  // ...
});
```

## Types

The `ponder` package exports several utility types. Use these types to maintain type safety when generating config options dynamically.

### DatabaseConfig

```ts [ponder.config.ts] {1,6}
import { createConfig, type DatabaseConfig } from "ponder"; // [!code focus]

const database = { // [!code focus]
  kind: "postgres", // [!code focus]
  connectionString: process.env.DATABASE_URL, // [!code focus]
} as const satisfies DatabaseConfig; // [!code focus]

export default createConfig({
  database,
  // ...
});
```

### ChainConfig

```ts [ponder.config.ts]
import { createConfig, type ChainConfig } from "ponder"; // [!code focus]

const mainnet = { // [!code focus]
  id: 1, // [!code focus]
  rpc: process.env.PONDER_RPC_URL_1, // [!code focus]
  ws: process.env.PONDER_WS_URL_1, // [!code focus]
} as const satisfies ChainConfig; // [!code focus]

export default createConfig({
  chains: {
    mainnet,
  }
  // ...
});
```

### ContractConfig

```ts [ponder.config.ts] {1}
import { createConfig, type ContractConfig } from "ponder"; // [!code focus]
import { Erc20Abi } from "./abis/Erc20Abi.ts";

const Erc20 = { // [!code focus]
  chain: "mainnet" // [!code focus]
  abi: Erc20Abi, // [!code focus]
  address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // [!code focus]
} as const satisfies ContractConfig; // [!code focus]

export default createConfig({
  contracts: {
    Erc20,
  },
  // ...
});
```

### BlockConfig

```ts [ponder.config.ts]
import { createConfig, type BlockConfig } from "ponder"; // [!code focus]

const ChainlinkPriceOracle = { // [!code focus]
  chain: "mainnet", // [!code focus]
  startBlock: 19_750_000, // [!code focus]
  interval: 5, // [!code focus]
} as const satisfies BlockConfig; // [!code focus]

export default createConfig({
  blocks: {
    ChainlinkPriceOracle,
  },
  // ...
});
```
# `ponder.schema.ts` [API reference]

:::tip
  This is a low-level reference. For an introduction and guides, visit the
  [Schema](/docs/schema/tables) section.
:::

The `ponder.schema.ts` file defines your database tables and their relationships. Each table you include in `ponder.schema.ts` will be created as an SQL table, populated during indexing, and exposed via the GraphQL API.

## File requirements

The `ponder.schema.ts` must use **named exports** for tables, enums, and relations. These objects must be created using the correct functions exported from `"ponder"{:ts}`.

```ts [ponder.schema.ts] {1,3}
import { onchainTable } from "ponder";

export const pets = onchainTable("pets", (t) => ({
  name: t.text().primaryKey(),
  age: t.integer().notNull(),
}));
```

## `onchainTable`

The `onchainTable` function accepts three positional arguments.

| field           |                      type                      | description                                                                               |
| :-------------- | :--------------------------------------------: | :---------------------------------------------------------------------------------------- |
| **name**        |                    `string`                    | The SQL table name. Use `snake_case`.                                                     |
| **columns**     | `(t: TableBuilder) => Record<string, Column>`  | A function that returns column definitions.                                               |
| **constraints** | `(table: Table) => Record<string, Constraint>` | Optional function that returns table constraints like composite primary keys and indexes. |

{/* prettier-ignore */}
```ts [ponder.schema.ts]
import { onchainTable } from "ponder";

export const transferEvents = onchainTable(
  "transfer_event", // SQL table name
  (t) => ({ // Column definitions
    id: t.text().primaryKey(),
    from: t.hex().notNull(),
    to: t.hex().notNull(),
    value: t.bigint().notNull(),
  }),
  (table) => ({ // Constraints & indexes
    fromIdx: index().on(table.from),
  })
);
```

### Column types

The schema definition API supports most PostgreSQL data types. Here's a quick reference for the most commonly used data types. For a complete list, visit the [Drizzle documentation](https://orm.drizzle.team/docs/column-types/pg).

| name             | description                                  | TypeScript type          | SQL data type         |
| :--------------- | :------------------------------------------- | :----------------------- | :-------------------- |
| `text{:ts}`      | UTF‐8 character sequence                     | `string`                 | `TEXT{:sql}`          |
| `integer{:ts}`   | Signed 4‐byte integer                        | `number`                 | `INTEGER{:sql}`       |
| `real{:ts}`      | Signed 4-byte floating‐point value           | `number`                 | `REAL{:sql}`          |
| `boolean{:ts}`   | `true` or `false`                            | `boolean`                | `BOOLEAN{:sql}`       |
| `timestamp{:ts}` | Date and time value (no time zone)           | `Date`                   | `TIMESTAMP{:sql}`     |
| `json{:ts}`      | JSON object                                  | `any` or [custom](#json) | `JSON{:sql}`          |
| `bigint{:ts}`    | Large integer (holds `uint256` and `int256`) | `bigint`                 | `NUMERIC(78,0){:sql}` |
| `hex{:ts}`       | UTF‐8 character sequence with `0x` prefix    | `0x${string}`            | `TEXT{:sql}`          |

### Column modifiers

Column modifiers can be chained after column type definitions.

| modifier                      | description                                    |
| :---------------------------- | :--------------------------------------------- |
| `.primaryKey(){:ts}`          | Marks column as the table's primary key        |
| `.notNull(){:ts}`             | Marks column as NOT NULL                       |
| `.array(){:ts}`               | Marks column as an array type                  |
| `.default(value){:ts}`        | Sets a default value for column                |
| `.$default(() => value){:ts}` | Sets a dynamic default via function            |
| `.$type<T>(){:ts}`            | Annotates column with a custom TypeScript type |

### Constraints

#### Primary key

Every table must have exactly one primary key defined using either the `.primaryKey()` column modifier or the `primaryKey()` function in the table constraints argument.

```ts [ponder.schema.ts] {1, 5, 16}
import { onchainTable, primaryKey } from "ponder";

// Single column primary key
export const tokens = onchainTable("tokens", (t) => ({
  id: t.bigint().primaryKey(),
}));

// Composite primary key
export const poolStates = onchainTable(
  "pool_states",
  (t) => ({
    poolId: t.bigint().notNull(),
    address: t.hex().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.poolId, table.address] }),
  })
);
```

### Indexes

Create indexes using the `index()` function in the constraints & indexes argument. Ponder creates database indexes after the backfill completes, just before
the app becomes ready.

```ts [ponder.schema.ts] {1,10}
import { onchainTable, index } from "ponder";

export const persons = onchainTable(
  "persons",
  (t) => ({
    id: t.text().primaryKey(),
    name: t.text(),
  }),
  (table) => ({
    nameIdx: index().on(table.name),
  })
);
```

## `onchainEnum`

The `onchainEnum` function accepts two positional arguments. It returns a function that can be used as a column type.

| field      |    type    | description                                                       |
| :--------- | :--------: | :---------------------------------------------------------------- |
| **name**   |  `string`  | The SQL enum name. Use `snake_case`.                              |
| **values** | `string[]` | An array of strings representing the allowed values for the enum. |

```ts [ponder.schema.ts] {3}
import { onchainEnum, onchainTable } from "ponder";

export const color = onchainEnum("color", ["ORANGE", "BLACK"]);

export const cats = onchainTable("cats", (t) => ({
  name: t.text().primaryKey(),
  color: color().notNull(),
}));
```

Like any other column types, you can use modifiers like `.notNull()`, `.default()`, and `.array()` with enum columns.

```ts [ponder.schema.ts] {5}
// ...

export const dogs = onchainTable("cats", (t) => ({
  name: t.text().primaryKey(),
  color: color().array().default([]),
}));
```

## `onchainView`

The `onchainView` function uses the Drizzle query builder API to define a custom query against other tables and views in `ponder.schema.ts`.

{/* prettier-ignore */}
```ts [ponder.schema.ts]
import { onchainView, sql, sum, count } from "ponder";

// ... `transferEvent` and other table definitions

export const hourlyBucket = onchainView("hourly_bucket").as((qb) =>
  qb
    .select({
      hour: sql`FLOOR(${transferEvent.timestamp} / 3600) * 3600`.as("hour"),
      totalVolume: sum(transferEvent.amount).as("total_volume"),
      transferCount: count().as("transfer_count"),
    })
    .from(transferEvent)
    .groupBy(sql`FLOOR(${transferEvent.timestamp} / 3600)`),
);
```

[Read more](https://orm.drizzle.team/docs/select) about the Drizzle query builder API.

## `relations`

Use the `relations` function to define relationships between tables.

```ts [ponder.schema.ts] {1,7}
import { onchainTable, relations } from "ponder";

export const users = onchainTable("users", (t) => ({
  id: t.text().primaryKey(),
}));

export const usersRelations = relations(users, ({ one }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
}));
```

### Relationship types

| type             | method      | description                                    |
| :--------------- | :---------- | :--------------------------------------------- |
| **One-to-one**   | `one()`     | References single related record               |
| **One-to-many**  | `many()`    | References array of related records            |
| **Many-to-many** | Combination | Uses join table with two one-to-many relations |

Read more in the [relationships guide](/docs/schema/relations) and the Drizzle [relations documentation](https://orm.drizzle.team/docs/relations).
# Observability [Logs, metrics, and indexing status]

## Logs

Ponder produces logs to help you understand and debug your application.

![Terminal logs gif](/logs-014.gif)

### Log level

There are two ways to configure the minimum log level. If specified, the environment variable takes precedence over the CLI flag.

- Set the `PONDER_LOG_LEVEL` environment variable
- Use the `--log-level <LEVEL>`, `-v` (debug) or `-vv` (trace) CLI option

```js [.env.local]
PONDER_LOG_LEVEL=trace
```

```bash [Terminal]
ponder dev --log-level warn
# or, use the shortcut flag for debug
ponder dev -v
```

#### Levels

| Log level        | Example                                                                    |
| :--------------- | :------------------------------------------------------------------------- |
| `silent`         |                                                                            |
| `error`          | Errors thrown in user code and other errors that will likely cause a crash |
| `warn`           | Malformed RPC data, reorgs, and other errors that will be retried          |
| `info` (default) | Indexing progress and key lifecycle events                                 |
| `debug`          | Internal updates                                                           |
| `trace`          | Database query logs, RPC request logs                                      |

#### User logs

Logs produced by your code (e.g. `console.log` statements in `ponder.config.ts` or indexing functions) will always be written to the console. Note that Ponder _does_ catch **errors** thrown by your code and emits an `error` log including the original error message and stack trace.

### Log format

Use the `--log-format <FORMAT>` CLI option to set the log format.

#### Pretty (default)

```bash [Terminal]
ponder start --log-format pretty
```

```bash [Output]
12:12:15.391 INFO  Indexed block chain=mainnet number=23569900 event_count=14 (23ms)
12:12:16.159 INFO  Indexed block chain=polygon number=77633630 event_count=0 (1ms)
12:12:16.174 INFO  Indexed block chain=optimism number=142386579 event_count=1 (4ms)
12:12:16.226 INFO  Indexed block chain=base number=36791294 event_count=9 (14ms)
12:12:18.068 INFO  Indexed block chain=optimism number=142386580 event_count=2 (8ms)
12:12:18.125 INFO  Indexed block chain=polygon number=77633631 event_count=0 (1ms)
12:12:18.188 INFO  Indexed block chain=base number=36791295 event_count=10 (16ms)
12:12:20.021 INFO  Indexed block chain=optimism number=142386581 event_count=0 (4ms)
```

#### JSON

```bash [Terminal]
ponder start --log-format json
```

The JSON log format emits newline-delimited JSON objects with required properties `level`, `time`, and `msg`. Most logs also include a `duration` property and other properties depending on the context.

```json [Output]
{"level":30,"time":1760372079306,"msg":"Indexed block","chain":"mainnet","chain_id":1,"number":23569912,"event_count":17,"duration":27.752416999996058}
{"level":30,"time":1760372080106,"msg":"Indexed block","chain":"polygon","chain_id":137,"number":77633702,"event_count":0,"duration":3.4684160000033444}
{"level":30,"time":1760372080122,"msg":"Indexed block","chain":"optimism","chain_id":10,"number":142386651,"event_count":0,"duration":2.3179999999993015}
{"level":30,"time":1760372080314,"msg":"Indexed block","chain":"base","chain_id":8453,"number":36791366,"event_count":10,"duration":18.320999999996275}
{"level":30,"time":1760372082131,"msg":"Indexed block","chain":"optimism","chain_id":10,"number":142386652,"event_count":0,"duration":3.074124999999185}
{"level":30,"time":1760372082258,"msg":"Indexed block","chain":"polygon","chain_id":137,"number":77633703,"event_count":0,"duration":1.7850829999952111}
{"level":30,"time":1760372082328,"msg":"Indexed block","chain":"base","chain_id":8453,"number":36791367,"event_count":4,"duration":9.394625000000815}
{"level":30,"time":1760372084153,"msg":"Indexed block","chain":"optimism","chain_id":10,"number":142386653,"event_count":0,"duration":2.679999999993015}
```

### Terminal UI

The dynamic terminal UI displays a useful summary of chain connection status, indexing function duration, and backfill progress.

```bash [Output]
Chains

│ Chain    │ Status │ Block     │ RPC (req/s) │
├──────────┼────────┼───────────┼─────────────┤
│ optimism │ live   │ 142388578 │         1.6 │
│ polygon  │ live   │  77635629 │        17.2 │
│ base     │ live   │  36793293 │         4.2 │
│ mainnet  │ live   │  23570232 │         7.5 │

Indexing (live)

│ Event         │ Count │ Duration (ms) │
├───────────────┼───────┼───────────────┤
│ WETH:Deposit  │   107 │         1.554 │

API endpoints
Live at http://localhost:42069
```

The terminal UI is disabled by default for `ponder start`. Use the `--disable-ui` CLI option to disable the UI for `ponder dev`.

```bash [Terminal]
ponder dev --disable-ui
```

## Metrics

Ponder apps publish Prometheus metrics at the `/metrics` path.

:::warning
Metrics are not part of the public API, so these are subject to change without notice. Do not rely on these metrics for anything important (yet).
:::

| name                                   | description                                                           | type      |
| :------------------------------------- | :-------------------------------------------------------------------- | --------- |
| ponder_indexing_total_seconds          | Total number of seconds required for indexing                         | gauge     |
| ponder_indexing_completed_seconds      | Number of seconds that have been completed                            | gauge     |
| ponder_indexing_completed_events       | Number of events that have been processed                             | gauge     |
| ponder_indexing_completed_timestamp    | Timestamp through which all events have been completed                | gauge     |
| ponder_indexing_function_duration      | Duration of indexing function execution                               | histogram |
| ponder_indexing_function_error_total   | Total number of errors encountered during indexing function execution | counter   |
| ponder_historical_start_timestamp      | Unix timestamp (ms) when the historical sync service started          | gauge     |
| ponder_historical_total_blocks         | Number of blocks required for the historical sync                     | gauge     |
| ponder_historical_cached_blocks        | Number of blocks that were found in the cache for the historical sync | gauge     |
| ponder_historical_completed_blocks     | Number of blocks that have been processed for the historical sync     | gauge     |
| ponder_realtime_is_connected           | Boolean (0 or 1) indicating if the realtime sync service is connected | gauge     |
| ponder_realtime_latest_block_number    | Block number of the latest synced block                               | gauge     |
| ponder_realtime_latest_block_timestamp | Block timestamp of the latest synced block                            | gauge     |
| ponder_realtime_reorg_total            | Count of how many re-orgs have occurred                               | counter   |
| ponder_database_method_duration        | Duration of database operations                                       | histogram |
| ponder_database_method_error_total     | Total number of errors encountered during database operations         | counter   |
| ponder_http_server_active_requests     | Number of active HTTP server requests                                 | gauge     |
| ponder_http_server_request_duration_ms | Duration of HTTP responses served by the server                       | histogram |
| ponder_http_server_request_size_bytes  | Size of HTTP requests received by the server                          | histogram |
| ponder_http_server_response_size_bytes | Size of HTTP responses served by the server                           | histogram |
| ponder_rpc_request_duration            | Duration of RPC requests                                              | histogram |
| ponder_rpc_request_error_total         | Total number of failed RPC requests                                   | counter   |
| ponder_postgres_pool_connections       | Gauge of current connections for PostgreSQL pools                     | gauge     |
| ponder_postgres_query_queue_size       | Current size of the query queue for PostgreSQL                        | gauge     |
| ponder_postgres_query_total            | Total number of queries processed by PostgreSQL                       | counter   |

## Indexing status

To check the indexing status of your app, use the `/status` endpoint or the `_meta` field in the GraphQL API.

### Usage

Use the indexing status to quickly confirm that Ponder is working as expected. You can also poll the status to confirm that a specific block number has been ingested by Ponder before refetching a query client-side (for example, in a form submit handler).

#### HTTP

```bash [Request]
curl http://localhost:42069/status
```

```json [Response]
{
  "mainnet": {
    "id": 1,
    "block": {
      "number": 20293450,
      "timestamp": 1720823759
    }
  },
  "base": {
    "id": 8453,
    "block": {
      "number": 17017206,
      "timestamp": 1720823759
    }
  }
}
```

#### GraphQL

```graphql [Query]
query {
  _meta {
    status
  }
}
```

```json [Result]
{
  "_meta": {
    "status": {
      "mainnet": {
        "id": 1,
        "block": {
          "number": 20293464,
          "timestamp": 1720823939
        }
      },
      "base": {
        "id": 8453,
        "block": null
      }
    }
  }
}
```

### API

The response object contains a property for each chain in your app with the following fields.

| field     |                       type                       | description                                                                 |
| :-------- | :----------------------------------------------: | :-------------------------------------------------------------------------- |
| **id**    |                     `number`                     | The chain ID.                                                               |
| **block** | `{ number: number; timestamp: number; } \| null` | The most recently indexed block, or `null` if the backfill is not complete. |
# Telemetry [How Ponder collects and uses telemetry]

Ponder collects **completely anonymous** telemetry data about general usage. The developers use this data to prioritize new feature development, identify bugs, and improve performance & stability.

## Opt out

To opt out of telemetry, set the `PONDER_TELEMETRY_DISABLED` environment variable.

{/* prettier-ignore */}
```js filename=".env.local"
PONDER_TELEMETRY_DISABLED = true
```

## Implementation

Ponder's telemetry implementation is 100% open-source. The [telemetry service](https://github.com/ponder-sh/ponder/blob/main/packages/core/src/common/telemetry.ts#L47) (part of `ponder`) runs on the user's device and submits event data via HTTP POST requests to the [telemetry collection endpoint](https://github.com/ponder-sh/ponder/blob/main/docs/pages/api/telemetry/index.ts) hosted at `https://ponder.sh/api/telemetry`.

The implementation generates a stable anonymous unique identifier for the user's device and stores it at the [system default user config directory](https://github.com/sindresorhus/env-paths#pathsconfig). This config also stores the user's opt-out preference and a stable salt used to hash potentially sensitive data such as file paths and the git remote URL.
