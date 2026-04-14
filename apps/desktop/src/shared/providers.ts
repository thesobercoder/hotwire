import type { DeviceFlowConfigDto } from "./types";

// GitHub Copilot OAuth device-flow configuration. The client_id below is the
// well-known Copilot CLI client used by first-party GitHub OAuth device flow.
export const COPILOT_DEVICE_FLOW_CONFIG: DeviceFlowConfigDto = {
  clientId: "Iv1.b507a08c87ecfe98",
  deviceAuthUrl: "https://github.com/login/device/code",
  tokenUrl: "https://github.com/login/oauth/access_token",
  scopes: ["read:user"],
};
