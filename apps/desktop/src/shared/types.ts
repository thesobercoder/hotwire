export type Provider = {
  id: string;
  type: string;
  apiKey: string;
  createdAt: string;
};

export type ProvidersApi = {
  list(): Promise<Provider[]>;
  save(type: string, apiKey: string): Promise<void>;
  remove(id: string): Promise<void>;
};

export type HotwireApi = {
  providers: ProvidersApi;
};
