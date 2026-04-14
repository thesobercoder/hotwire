import { Context, Data, Duration, Effect, Either, Schema } from "effect";

export class DeviceFlowError extends Data.TaggedError("DeviceFlowError")<{
  readonly cause: unknown;
}> {}

export class DeviceFlowExpired extends Data.TaggedError("DeviceFlowExpired")<
  Record<string, never>
> {}

export class DeviceFlowAccessDenied extends Data.TaggedError(
  "DeviceFlowAccessDenied",
)<Record<string, never>> {}

export type DeviceFlowPollError =
  | DeviceFlowError
  | DeviceFlowExpired
  | DeviceFlowAccessDenied;

export const DeviceFlowConfig = Schema.Struct({
  clientId: Schema.String,
  deviceAuthUrl: Schema.String,
  tokenUrl: Schema.String,
  scopes: Schema.Array(Schema.String),
});

export type DeviceFlowConfig = typeof DeviceFlowConfig.Type;

export const DeviceCodeResponse = Schema.Struct({
  deviceCode: Schema.String,
  userCode: Schema.String,
  verificationUri: Schema.String,
  expiresIn: Schema.Number,
  interval: Schema.Number,
});

export type DeviceCodeResponse = typeof DeviceCodeResponse.Type;

const DeviceCodeWireResponse = Schema.Struct({
  device_code: Schema.String,
  user_code: Schema.String,
  verification_uri: Schema.String,
  expires_in: Schema.Number,
  interval: Schema.Number,
});

export const TokenResponse = Schema.Struct({
  accessToken: Schema.String,
  refreshToken: Schema.optional(Schema.String),
  expiresIn: Schema.optional(Schema.Number),
});

export type TokenResponse = typeof TokenResponse.Type;

const TokenSuccessWire = Schema.Struct({
  access_token: Schema.String,
  refresh_token: Schema.optional(Schema.String),
  expires_in: Schema.optional(Schema.Number),
});

const TokenErrorWire = Schema.Struct({
  error: Schema.String,
});

const TOKEN_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

export class DeviceFlowHttp extends Context.Tag(
  "@hotwire/oauth/DeviceFlowHttp",
)<
  DeviceFlowHttp,
  {
    readonly post: (
      url: string,
      body: URLSearchParams,
    ) => Effect.Effect<unknown, DeviceFlowError>;
  }
>() {}

export const requestDeviceCode = (
  config: DeviceFlowConfig,
): Effect.Effect<DeviceCodeResponse, DeviceFlowError, DeviceFlowHttp> =>
  Effect.gen(function* () {
    const http = yield* DeviceFlowHttp;
    const body = new URLSearchParams();
    body.append("client_id", config.clientId);
    body.append("scope", config.scopes.join(" "));

    const raw = yield* http.post(config.deviceAuthUrl, body);
    const parsed = yield* Schema.decodeUnknown(DeviceCodeWireResponse)(
      raw,
    ).pipe(Effect.mapError((cause) => new DeviceFlowError({ cause })));

    return {
      deviceCode: parsed.device_code,
      userCode: parsed.user_code,
      verificationUri: parsed.verification_uri,
      expiresIn: parsed.expires_in,
      interval: parsed.interval,
    };
  });

export const pollForToken = (
  config: DeviceFlowConfig,
  deviceCode: string,
  interval: number,
): Effect.Effect<TokenResponse, DeviceFlowPollError, DeviceFlowHttp> => {
  const body = new URLSearchParams();
  body.append("client_id", config.clientId);
  body.append("device_code", deviceCode);
  body.append("grant_type", TOKEN_GRANT_TYPE);

  const attempt = (
    currentInterval: number,
  ): Effect.Effect<TokenResponse, DeviceFlowPollError, DeviceFlowHttp> =>
    Effect.gen(function* () {
      const http = yield* DeviceFlowHttp;
      const raw = yield* http.post(config.tokenUrl, body);

      const errorResult = Schema.decodeUnknownEither(TokenErrorWire)(raw);
      if (Either.isRight(errorResult)) {
        const code = errorResult.right.error;
        if (code === "authorization_pending") {
          yield* Effect.sleep(Duration.seconds(currentInterval));
          return yield* attempt(currentInterval);
        }
        if (code === "slow_down") {
          const nextInterval = currentInterval + 5;
          yield* Effect.sleep(Duration.seconds(nextInterval));
          return yield* attempt(nextInterval);
        }
        if (code === "expired_token") {
          return yield* Effect.fail(new DeviceFlowExpired());
        }
        if (code === "access_denied") {
          return yield* Effect.fail(new DeviceFlowAccessDenied());
        }
        return yield* Effect.fail(
          new DeviceFlowError({ cause: errorResult.right }),
        );
      }

      const parsed = yield* Schema.decodeUnknown(TokenSuccessWire)(raw).pipe(
        Effect.mapError((cause) => new DeviceFlowError({ cause })),
      );
      return {
        accessToken: parsed.access_token,
        refreshToken: parsed.refresh_token,
        expiresIn: parsed.expires_in,
      };
    });

  return attempt(interval);
};
