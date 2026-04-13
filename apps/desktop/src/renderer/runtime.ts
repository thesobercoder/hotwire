import { ManagedRuntime } from "effect";

import { ProvidersClientLive } from "./services/providers-client";

export const appRuntime = ManagedRuntime.make(ProvidersClientLive);
