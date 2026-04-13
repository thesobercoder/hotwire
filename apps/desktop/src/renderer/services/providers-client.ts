import { Context, Data, Effect, Layer } from "effect";

import type { Provider } from "../../shared/types";

export class ProvidersClientError extends Data.TaggedError(
  "ProvidersClientError",
)<{
  readonly cause: unknown;
}> {}

export class ProvidersClient extends Context.Tag(
  "@hotwire/desktop/ProvidersClient",
)<
  ProvidersClient,
  {
    readonly list: Effect.Effect<Provider[], ProvidersClientError>;
    readonly save: (
      type: string,
      apiKey: string,
    ) => Effect.Effect<void, ProvidersClientError>;
    readonly remove: (id: string) => Effect.Effect<void, ProvidersClientError>;
  }
>() {}

export const ProvidersClientLive = Layer.succeed(ProvidersClient, {
  list: Effect.tryPromise({
    try: () => window.hotwire.providers.list(),
    catch: (cause) => new ProvidersClientError({ cause }),
  }),

  save: (type, apiKey) =>
    Effect.tryPromise({
      try: () => window.hotwire.providers.save(type, apiKey),
      catch: (cause) => new ProvidersClientError({ cause }),
    }),

  remove: (id) =>
    Effect.tryPromise({
      try: () => window.hotwire.providers.remove(id),
      catch: (cause) => new ProvidersClientError({ cause }),
    }),
});
