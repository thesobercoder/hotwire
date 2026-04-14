import { useState } from "react";

import { Effect } from "effect";

import type {
  DeviceCodeResponseDto,
  DeviceFlowConfigDto,
  TokenResponseDto,
} from "../../shared/types";
import { appRuntime } from "../runtime";
import { DeviceFlowClient } from "../services/device-flow-client";

type Status =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "pending"; code: DeviceCodeResponseDto }
  | { kind: "error"; message: string };

type DeviceFlowCardProps = {
  readonly providerType: string;
  readonly config: DeviceFlowConfigDto;
  readonly onComplete: (tokens: TokenResponseDto) => void;
};

export function DeviceFlowCard({
  providerType,
  config,
  onComplete,
}: DeviceFlowCardProps) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const handleConnect = () => {
    if (status.kind !== "idle" && status.kind !== "error") return;
    setStatus({ kind: "starting" });
    void appRuntime
      .runPromise(
        Effect.gen(function* () {
          const client = yield* DeviceFlowClient;
          const code = yield* client.start(config);
          return code;
        }),
      )
      .then((code) => {
        setStatus({ kind: "pending", code });
        void appRuntime
          .runPromise(
            Effect.gen(function* () {
              const client = yield* DeviceFlowClient;
              return yield* client.poll(config, code.deviceCode, code.interval);
            }),
          )
          .then((tokens) => {
            onComplete(tokens);
          })
          .catch((error) => {
            setStatus({
              kind: "error",
              message: error instanceof Error ? error.message : String(error),
            });
          });
      })
      .catch((error) => {
        setStatus({
          kind: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      });
  };

  const handleOpenUrl = (
    event: React.MouseEvent<HTMLAnchorElement>,
    url: string,
  ) => {
    event.preventDefault();
    void appRuntime.runPromise(
      Effect.gen(function* () {
        const client = yield* DeviceFlowClient;
        yield* client.openUrl(url);
      }),
    );
  };

  return (
    <article data-provider-type={providerType}>
      {status.kind === "idle" || status.kind === "error" ? (
        <button type="button" onClick={handleConnect}>
          Connect
        </button>
      ) : null}

      {status.kind === "starting" ? <p>Requesting device code…</p> : null}

      {status.kind === "pending" ? (
        <div>
          <p>
            Enter this code: <code>{status.code.userCode}</code>
          </p>
          <p>
            at{" "}
            <a
              href={status.code.verificationUri}
              onClick={(event) =>
                handleOpenUrl(event, status.code.verificationUri)
              }
            >
              {status.code.verificationUri}
            </a>
          </p>
        </div>
      ) : null}

      {status.kind === "error" ? (
        <p role="alert">Error: {status.message}</p>
      ) : null}
    </article>
  );
}
