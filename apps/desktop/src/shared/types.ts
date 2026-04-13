import { Schema } from "effect";

export const Provider = Schema.Struct({
  id: Schema.String,
  type: Schema.String,
  apiKey: Schema.String,
  createdAt: Schema.String,
});

export type Provider = typeof Provider.Type;

export type ProvidersApi = {
  list(): Promise<Provider[]>;
  save(type: string, apiKey: string): Promise<void>;
  remove(id: string): Promise<void>;
  hasEnabledModel(): Promise<boolean>;
};

export type HotwireApi = {
  providers: ProvidersApi;
};
