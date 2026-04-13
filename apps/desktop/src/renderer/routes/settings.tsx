import { useState } from "react";

import { getRouteApi, useRouter } from "@tanstack/react-router";
import { Effect } from "effect";

import { appRuntime } from "../runtime";
import { ProvidersClient } from "../services/providers-client";

const route = getRouteApi("/settings");

export function SettingsRoute() {
  const providers = route.useLoaderData();
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");

  const anthropic = providers.find((p) => p.type === "anthropic");

  const handleSave = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    void appRuntime
      .runPromise(
        Effect.gen(function* () {
          const client = yield* ProvidersClient;
          yield* client.save("anthropic", trimmed);
        }),
      )
      .then(() => {
        setApiKey("");
        void router.invalidate();
      });
  };

  const handleDisconnect = () => {
    if (!anthropic) return;
    void appRuntime
      .runPromise(
        Effect.gen(function* () {
          const client = yield* ProvidersClient;
          yield* client.remove(anthropic.id);
        }),
      )
      .then(() => router.invalidate());
  };

  return (
    <section>
      <h1>Settings</h1>
      <article>
        <h2>Anthropic</h2>
        {anthropic ? (
          <>
            <p>
              Connected — key ending in{" "}
              <code>{anthropic.apiKey.slice(-4)}</code>
            </p>
            <button type="button" onClick={handleDisconnect}>
              Disconnect
            </button>
          </>
        ) : (
          <>
            <label htmlFor="anthropic-api-key">API key</label>
            <input
              id="anthropic-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
            />
            <button type="button" onClick={handleSave}>
              Save
            </button>
          </>
        )}
      </article>
    </section>
  );
}
