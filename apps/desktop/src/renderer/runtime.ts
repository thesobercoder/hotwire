import { Layer, ManagedRuntime } from "effect";

import { DeviceFlowClientLive } from "./services/device-flow-client";
import { ProvidersClientLive } from "./services/providers-client";

export const appRuntime = ManagedRuntime.make(
  Layer.mergeAll(ProvidersClientLive, DeviceFlowClientLive),
);
