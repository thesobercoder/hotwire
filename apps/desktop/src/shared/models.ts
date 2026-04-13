export type ModelDefinition = {
  readonly id: string;
  readonly label: string;
};

export const PROVIDER_MODELS: Record<string, readonly ModelDefinition[]> = {
  anthropic: [
    { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    { id: "claude-opus-4-20250514", label: "Claude Opus 4" },
    { id: "claude-haiku-3-5-20241022", label: "Claude Haiku 3.5" },
  ],
};
