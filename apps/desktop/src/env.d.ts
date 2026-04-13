import type { HotwireApi } from "./shared/types";

declare global {
  interface Window {
    hotwire: HotwireApi;
  }
}
