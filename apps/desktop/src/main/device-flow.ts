import { Layer } from "effect";
import { Effect } from "effect";

import { DeviceFlowError, DeviceFlowHttp } from "@hotwire/oauth";

export const DeviceFlowHttpLive = Layer.succeed(DeviceFlowHttp, {
  post: (url, body) =>
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: body.toString(),
        });
        const text = await response.text();
        try {
          return JSON.parse(text) as unknown;
        } catch (parseError) {
          throw new Error(
            `Non-JSON response from ${url} (status ${response.status}): ${text.slice(0, 200)}`,
            { cause: parseError },
          );
        }
      },
      catch: (cause) => new DeviceFlowError({ cause }),
    }),
});
