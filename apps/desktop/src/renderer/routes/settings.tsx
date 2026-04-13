import { useState } from "react";

import { getRouteApi, useRouter } from "@tanstack/react-router";
import { Effect } from "effect";

import { PROVIDER_MODELS } from "../../shared/models";
import { appRuntime } from "../runtime";
import { ProvidersClient } from "../services/providers-client";

const route = getRouteApi("/settings");

export function SettingsRoute() {
  const { providers, models } = route.useLoaderData();
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");

  const anthropic = providers.find((p) => p.type === "anthropic");
  const anthropicModels = anthropic ? (models.get(anthropic.id) ?? []) : [];
  const enabledModelIds = new Set(
    anthropicModels.filter((m) => m.enabled).map((m) => m.modelId),
  );
  const allModelsDisabled =
    anthropic !== undefined && enabledModelIds.size === 0;

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

  const handleModelToggle = (modelId: string, enabled: boolean) => {
    if (!anthropic) return;
    void appRuntime
      .runPromise(
        Effect.gen(function* () {
          const client = yield* ProvidersClient;
          yield* client.setModelEnabled(anthropic.id, modelId, enabled);
        }),
      )
      .then(() => router.invalidate());
  };

  const availableModels = PROVIDER_MODELS["anthropic"] ?? [];

  return (
    <section>
      <h1>Settings</h1>
      <article>
        <h2>Anthropic</h2>
        {anthropic ? (
          <>
            <p>
              {allModelsDisabled
                ? "Disconnected — no models enabled"
                : "Connected"}{" "}
              — key ending in <code>{anthropic.apiKey.slice(-4)}</code>
            </p>
            <fieldset>
              <legend>Models</legend>
              {availableModels.map((model) => (
                <label key={model.id}>
                  <input
                    type="checkbox"
                    checked={enabledModelIds.has(model.id)}
                    onChange={(e) =>
                      handleModelToggle(model.id, e.target.checked)
                    }
                  />
                  {model.label}
                </label>
              ))}
            </fieldset>
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
