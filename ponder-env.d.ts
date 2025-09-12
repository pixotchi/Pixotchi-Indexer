/// <reference types="ponder/types" />

declare module "ponder:registry" {
  type config = typeof import("./ponder.config.ts").default;
  type schema = typeof import("./ponder.schema.ts");

  export const ponder: import("ponder").PonderApp<config, schema>;

  export type EventNames = import("ponder").EventNames<config>;
  export type Event<name extends EventNames = EventNames> = import("ponder").Event<
    config,
    name
  >;

  export type Context<name extends EventNames = EventNames> = import("ponder").Context<
    config,
    schema,
    name
  >;

  export type ApiContext = import("ponder").ApiContext<schema>;
  export type IndexingFunctionArgs<name extends EventNames = EventNames> =
    import("ponder").IndexingFunctionArgs<config, schema, name>;

  export type Schema = import("ponder").Schema<schema>;
}
