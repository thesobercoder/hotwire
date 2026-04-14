import { ManagedRuntime } from "effect";

import { DeviceFlowClientLive } from "./services/device-flow-client";
import { ProvidersClientLive } from "./services/providers-client";

export const appRuntime = ManagedRuntime.make(ProvidersClientLive);
export const deviceFlowRuntime = ManagedRuntime.make(DeviceFlowClientLive);
