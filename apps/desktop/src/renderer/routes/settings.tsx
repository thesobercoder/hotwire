import { useCallback, useEffect, useState } from "react";

import type { Provider } from "../../shared/types";

export function SettingsRoute() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [apiKey, setApiKey] = useState("");

  const loadProviders = useCallback(async () => {
    const result = await window.hotwire.providers.list();
    setProviders(result);
  }, []);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  const anthropic = providers.find((p) => p.type === "anthropic");

  const handleSave = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    await window.hotwire.providers.save("anthropic", trimmed);
    setApiKey("");
    await loadProviders();
  };

  const handleDisconnect = async () => {
    if (!anthropic) return;
    await window.hotwire.providers.remove(anthropic.id);
    await loadProviders();
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
