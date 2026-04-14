import { Duration, Effect, Fiber, Layer, TestClock, TestContext } from "effect";

import {
  DeviceFlowAccessDenied,
  DeviceFlowExpired,
  DeviceFlowHttp,
  pollForToken,
  requestDeviceCode,
} from "../src/device-flow.js";

type HttpCall = {
  url: string;
  body: Record<string, string>;
};

function stubHttp(
  handler: (call: HttpCall) => unknown,
  recorder?: HttpCall[],
): Layer.Layer<DeviceFlowHttp> {
  return Layer.succeed(DeviceFlowHttp, {
    post: (url, body) =>
      Effect.sync(() => {
        const record: HttpCall = {
          url,
          body: Object.fromEntries(body.entries()),
        };
        recorder?.push(record);
        return handler(record);
      }),
  });
}

function scriptedHttp(
  responses: unknown[],
  recorder?: HttpCall[],
): Layer.Layer<DeviceFlowHttp> {
  let index = 0;
  return stubHttp(() => {
    const response = responses[index];
    index += 1;
    return response;
  }, recorder);
}

describe("requestDeviceCode", () => {
  it("POSTs the device code request and returns a parsed DeviceCodeResponse", () => {
    const calls: HttpCall[] = [];
    const http = stubHttp(
      () => ({
        device_code: "DEVICE-CODE",
        user_code: "WDJB-MJHT",
        verification_uri: "https://example.com/device",
        expires_in: 900,
        interval: 5,
      }),
      calls,
    );

    const result = Effect.runSync(
      requestDeviceCode({
        clientId: "test-client",
        deviceAuthUrl: "https://example.com/device/code",
        tokenUrl: "https://example.com/token",
        scopes: ["read:user", "repo"],
      }).pipe(Effect.provide(http)),
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://example.com/device/code");
    expect(calls[0]?.body).toEqual({
      client_id: "test-client",
      scope: "read:user repo",
    });

    expect(result).toEqual({
      deviceCode: "DEVICE-CODE",
      userCode: "WDJB-MJHT",
      verificationUri: "https://example.com/device",
      expiresIn: 900,
      interval: 5,
    });
  });
});

describe("pollForToken", () => {
  it("POSTs token request with device_code and returns parsed TokenResponse on immediate success", async () => {
    const calls: HttpCall[] = [];
    const http = stubHttp(
      () => ({
        access_token: "ACCESS-TOKEN",
        refresh_token: "REFRESH-TOKEN",
        expires_in: 3600,
      }),
      calls,
    );

    const result = await Effect.runPromise(
      pollForToken(
        {
          clientId: "test-client",
          deviceAuthUrl: "https://example.com/device/code",
          tokenUrl: "https://example.com/token",
          scopes: ["read:user"],
        },
        "DEVICE-CODE",
        5,
      ).pipe(Effect.provide(http)),
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://example.com/token");
    expect(calls[0]?.body).toEqual({
      client_id: "test-client",
      device_code: "DEVICE-CODE",
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    });
    expect(result).toEqual({
      accessToken: "ACCESS-TOKEN",
      refreshToken: "REFRESH-TOKEN",
      expiresIn: 3600,
    });
  });

  it("bumps interval by 5 seconds on slow_down before the next poll", async () => {
    const calls: HttpCall[] = [];
    const http = scriptedHttp(
      [
        { error: "slow_down" },
        {
          access_token: "ACCESS-TOKEN",
        },
      ],
      calls,
    );

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.fork(
          pollForToken(
            {
              clientId: "test-client",
              deviceAuthUrl: "https://example.com/device/code",
              tokenUrl: "https://example.com/token",
              scopes: ["read:user"],
            },
            "DEVICE-CODE",
            1,
          ),
        );

        // After first slow_down, interval bumps to 1 + 5 = 6 seconds.
        // Advancing only 5 seconds should NOT trigger the next poll.
        yield* TestClock.adjust(Duration.seconds(5));
        expect(calls).toHaveLength(1);

        // The remaining 1 second completes the 6-second wait.
        yield* TestClock.adjust(Duration.seconds(1));

        return yield* Fiber.join(fiber);
      }).pipe(Effect.provide(Layer.merge(http, TestContext.TestContext))),
    );

    expect(calls).toHaveLength(2);
    expect(result.accessToken).toBe("ACCESS-TOKEN");
  });

  it("retries on authorization_pending and eventually returns tokens", async () => {
    const calls: HttpCall[] = [];
    const http = scriptedHttp(
      [
        { error: "authorization_pending" },
        { error: "authorization_pending" },
        {
          access_token: "ACCESS-TOKEN",
          refresh_token: "REFRESH-TOKEN",
          expires_in: 3600,
        },
      ],
      calls,
    );

    const result = await Effect.runPromise(
      pollForToken(
        {
          clientId: "test-client",
          deviceAuthUrl: "https://example.com/device/code",
          tokenUrl: "https://example.com/token",
          scopes: ["read:user"],
        },
        "DEVICE-CODE",
        0,
      ).pipe(Effect.provide(http)),
    );

    expect(calls).toHaveLength(3);
    expect(result).toEqual({
      accessToken: "ACCESS-TOKEN",
      refreshToken: "REFRESH-TOKEN",
      expiresIn: 3600,
    });
  });

  it("fails with DeviceFlowExpired on expired_token error", async () => {
    const http = scriptedHttp([{ error: "expired_token" }]);

    const exit = await Effect.runPromise(
      pollForToken(
        {
          clientId: "test-client",
          deviceAuthUrl: "https://example.com/device/code",
          tokenUrl: "https://example.com/token",
          scopes: [],
        },
        "DEVICE-CODE",
        0,
      ).pipe(Effect.provide(http), Effect.exit),
    );

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      const failure = exit.cause;
      expect(failure._tag).toBe("Fail");
      if (failure._tag === "Fail") {
        expect(failure.error).toBeInstanceOf(DeviceFlowExpired);
      }
    }
  });

  it("fails with DeviceFlowAccessDenied on access_denied error", async () => {
    const http = scriptedHttp([{ error: "access_denied" }]);

    const exit = await Effect.runPromise(
      pollForToken(
        {
          clientId: "test-client",
          deviceAuthUrl: "https://example.com/device/code",
          tokenUrl: "https://example.com/token",
          scopes: [],
        },
        "DEVICE-CODE",
        0,
      ).pipe(Effect.provide(http), Effect.exit),
    );

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      const failure = exit.cause;
      expect(failure._tag).toBe("Fail");
      if (failure._tag === "Fail") {
        expect(failure.error).toBeInstanceOf(DeviceFlowAccessDenied);
      }
    }
  });
});
