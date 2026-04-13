import { Schema } from "effect";

export const Provider = Schema.Struct({
  id: Schema.String,
  type: Schema.String,
  apiKey: Schema.String,
  createdAt: Schema.String,
});

export type Provider = typeof Provider.Type;

export const ProviderModel = Schema.Struct({
  providerId: Schema.String,
  modelId: Schema.String,
  enabled: Schema.Boolean,
});

export type ProviderModel = typeof ProviderModel.Type;

export type ProvidersApi = {
  list(): Promise<Provider[]>;
  save(type: string, apiKey: string): Promise<void>;
  remove(id: string): Promise<void>;
  hasEnabledModel(): Promise<boolean>;
  listModels(providerId: string): Promise<ProviderModel[]>;
  setModelEnabled(
    providerId: string,
    modelId: string,
    enabled: boolean,
  ): Promise<void>;
};

export type HotwireApi = {
  providers: ProvidersApi;
};
