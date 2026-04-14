import { Schema } from "effect";

const PartBase = {
  id: Schema.String,
  sessionID: Schema.String,
  messageID: Schema.String,
};

const TimeRange = Schema.Struct({
  start: Schema.Number,
  end: Schema.optional(Schema.Number),
});

const Metadata = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
});

export const TextPart = Schema.Struct({
  ...PartBase,
  type: Schema.Literal("text"),
  text: Schema.String,
  synthetic: Schema.optional(Schema.Boolean),
  ignored: Schema.optional(Schema.Boolean),
  time: Schema.optional(TimeRange),
  metadata: Schema.optional(Metadata),
});

export type TextPart = typeof TextPart.Type;

export const ReasoningPart = Schema.Struct({
  ...PartBase,
  type: Schema.Literal("reasoning"),
  text: Schema.String,
  time: TimeRange,
  metadata: Schema.optional(Metadata),
});

export type ReasoningPart = typeof ReasoningPart.Type;

export const Part = Schema.Union(TextPart, ReasoningPart);

export type Part = typeof Part.Type;

const MessageBase = {
  id: Schema.String,
  sessionID: Schema.String,
  time: Schema.Struct({ created: Schema.Number }),
};

export const UserMessage = Schema.Struct({
  ...MessageBase,
  role: Schema.Literal("user"),
});

export type UserMessage = typeof UserMessage.Type;

export const AssistantMessage = Schema.Struct({
  ...MessageBase,
  role: Schema.Literal("assistant"),
});

export type AssistantMessage = typeof AssistantMessage.Type;

export const MessageInfo = Schema.Union(UserMessage, AssistantMessage);

export type MessageInfo = typeof MessageInfo.Type;
