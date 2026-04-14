import { Schema } from "effect";

export const Provider = Schema.Struct({
  id: Schema.String,
  type: Schema.String,
  apiKey: Schema.String,
  createdAt: Schema.String,
});

export type Provider = typeof Provider.Type;

export type DeviceFlowConfigDto = {
  clientId: string;
  deviceAuthUrl: string;
  tokenUrl: string;
  scopes: string[];
};

export type DeviceCodeResponseDto = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
};

export type TokenResponseDto = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
};

export type DeviceFlowApi = {
  start(config: DeviceFlowConfigDto): Promise<DeviceCodeResponseDto>;
  poll(
    config: DeviceFlowConfigDto,
    deviceCode: string,
    interval: number,
  ): Promise<TokenResponseDto>;
  openUrl(url: string): Promise<void>;
};

export const ProviderModel = Schema.Struct({
  providerId: Schema.String,
  modelId: Schema.String,
  enabled: Schema.Boolean,
});

export type ProviderModel = typeof ProviderModel.Type;

export type ProvidersApi = {
  list(): Promise<Provider[]>;
  save(type: string, apiKey: string): Promise<void>;
  saveOAuth(type: string, tokens: TokenResponseDto): Promise<void>;
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
  deviceFlow: DeviceFlowApi;
};
