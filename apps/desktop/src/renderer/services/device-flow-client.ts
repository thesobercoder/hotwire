import { Context, Data, Effect, Layer } from "effect";

import type {
  DeviceCodeResponseDto,
  DeviceFlowConfigDto,
  TokenResponseDto,
} from "../../shared/types";

export class DeviceFlowClientError extends Data.TaggedError(
  "DeviceFlowClientError",
)<{
  readonly cause: unknown;
}> {}

export class DeviceFlowClient extends Context.Tag(
  "@hotwire/desktop/DeviceFlowClient",
)<
  DeviceFlowClient,
  {
    readonly start: (
      config: DeviceFlowConfigDto,
    ) => Effect.Effect<DeviceCodeResponseDto, DeviceFlowClientError>;
    readonly poll: (
      config: DeviceFlowConfigDto,
      deviceCode: string,
      interval: number,
    ) => Effect.Effect<TokenResponseDto, DeviceFlowClientError>;
    readonly openUrl: (
      url: string,
    ) => Effect.Effect<void, DeviceFlowClientError>;
  }
>() {}

export const DeviceFlowClientLive = Layer.succeed(DeviceFlowClient, {
  start: (config) =>
    Effect.tryPromise({
      try: () => window.hotwire.deviceFlow.start(config),
      catch: (cause) => new DeviceFlowClientError({ cause }),
    }),
  poll: (config, deviceCode, interval) =>
    Effect.tryPromise({
      try: () => window.hotwire.deviceFlow.poll(config, deviceCode, interval),
      catch: (cause) => new DeviceFlowClientError({ cause }),
    }),
  openUrl: (url) =>
    Effect.tryPromise({
      try: () => window.hotwire.deviceFlow.openUrl(url),
      catch: (cause) => new DeviceFlowClientError({ cause }),
    }),
});
