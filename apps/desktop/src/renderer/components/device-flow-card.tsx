import { useState } from "react";

import { Effect } from "effect";

import type {
  DeviceCodeResponseDto,
  DeviceFlowConfigDto,
  TokenResponseDto,
} from "../../shared/types";
import { deviceFlowRuntime } from "../runtime";
import { DeviceFlowClient } from "../services/device-flow-client";

type Status =
  | { kind: "idle" }
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
    void deviceFlowRuntime
      .runPromise(
        Effect.gen(function* () {
          const client = yield* DeviceFlowClient;
          const code = yield* client.start(config);
          return code;
        }),
      )
      .then((code) => {
        setStatus({ kind: "pending", code });
        void deviceFlowRuntime
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
    void deviceFlowRuntime.runPromise(
      Effect.gen(function* () {
        const client = yield* DeviceFlowClient;
        yield* client.openUrl(url);
      }),
    );
  };

  return (
    <article data-provider-type={providerType}>
      {status.kind === "idle" ? (
        <button type="button" onClick={handleConnect}>
          Connect
        </button>
      ) : null}

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
