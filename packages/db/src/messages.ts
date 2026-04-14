import { Context, Effect, Layer, Schema } from "effect";

import { Database } from "./database.js";
import { DatabaseError } from "./providers.js";

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

const OutputFormatText = Schema.Struct({
  type: Schema.Literal("text"),
});

const OutputFormatJsonSchema = Schema.Struct({
  type: Schema.Literal("json_schema"),
  schema: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  retryCount: Schema.Number,
});

export const OutputFormat = Schema.Union(
  OutputFormatText,
  OutputFormatJsonSchema,
);

export type OutputFormat = typeof OutputFormat.Type;

const UserSummary = Schema.Struct({
  title: Schema.optional(Schema.String),
  body: Schema.optional(Schema.String),
  diffs: Schema.Array(Schema.Unknown),
});

const ModelRef = Schema.Struct({
  providerID: Schema.String,
  modelID: Schema.String,
  variant: Schema.optional(Schema.String),
});

export const UserMessage = Schema.Struct({
  id: Schema.String,
  sessionID: Schema.String,
  role: Schema.Literal("user"),
  time: Schema.Struct({
    created: Schema.Number,
  }),
  format: Schema.optional(OutputFormat),
  summary: Schema.optional(UserSummary),
  agent: Schema.String,
  model: ModelRef,
  system: Schema.optional(Schema.String),
  tools: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Boolean }),
  ),
});

export type UserMessage = typeof UserMessage.Type;

const Tokens = Schema.Struct({
  total: Schema.optional(Schema.Number),
  input: Schema.Number,
  output: Schema.Number,
  reasoning: Schema.Number,
  cache: Schema.Struct({
    read: Schema.Number,
    write: Schema.Number,
  }),
});

export const AssistantMessage = Schema.Struct({
  id: Schema.String,
  sessionID: Schema.String,
  role: Schema.Literal("assistant"),
  time: Schema.Struct({
    created: Schema.Number,
    completed: Schema.optional(Schema.Number),
  }),
  error: Schema.optional(Schema.Unknown),
  parentID: Schema.String,
  modelID: Schema.String,
  providerID: Schema.String,
  mode: Schema.String,
  agent: Schema.String,
  path: Schema.Struct({
    cwd: Schema.String,
    root: Schema.String,
  }),
  summary: Schema.optional(Schema.Boolean),
  cost: Schema.Number,
  tokens: Tokens,
  structured: Schema.optional(Schema.Unknown),
  variant: Schema.optional(Schema.String),
  finish: Schema.optional(Schema.String),
});

export type AssistantMessage = typeof AssistantMessage.Type;

export const MessageInfo = Schema.Union(UserMessage, AssistantMessage);

export type MessageInfo = typeof MessageInfo.Type;

export type MessageWithParts = {
  readonly info: MessageInfo;
  readonly parts: ReadonlyArray<Part>;
};

const decodeMessageInfo = Schema.decodeUnknownSync(MessageInfo);
const decodePart = Schema.decodeUnknownSync(Part);

export class MessageRepo extends Context.Tag("@hotwire/db/MessageRepo")<
  MessageRepo,
  {
    readonly create: (info: MessageInfo) => Effect.Effect<void, DatabaseError>;
    readonly appendPart: (part: Part) => Effect.Effect<void, DatabaseError>;
    readonly listBySession: (
      sessionID: string,
    ) => Effect.Effect<ReadonlyArray<MessageWithParts>, DatabaseError>;
  }
>() {}

export const MessageRepoLive = Layer.effect(
  MessageRepo,
  Effect.gen(function* () {
    const db = yield* Database;

    const timeOf = (info: MessageInfo) => info.time.created;

    return {
      create: (info) =>
        Effect.try({
          try: () => {
            const created = timeOf(info);
            db.prepare(
              `INSERT INTO message (id, session_id, data, time_created, time_updated)
               VALUES (?, ?, ?, ?, ?)`,
            ).run(info.id, info.sessionID, JSON.stringify(info), created, created);
          },
          catch: (cause) => new DatabaseError({ cause }),
        }),

      appendPart: (part) =>
        Effect.try({
          try: () => {
            const now = Date.now();
            db.prepare(
              `INSERT INTO part (id, message_id, session_id, data, time_created, time_updated)
               VALUES (?, ?, ?, ?, ?, ?)`,
            ).run(
              part.id,
              part.messageID,
              part.sessionID,
              JSON.stringify(part),
              now,
              now,
            );
          },
          catch: (cause) => new DatabaseError({ cause }),
        }),

      listBySession: (sessionID) =>
        Effect.try({
          try: () => {
            const messageRows = db
              .prepare(
                `SELECT id, data FROM message
                 WHERE session_id = ?
                 ORDER BY time_created ASC, id ASC`,
              )
              .all(sessionID) as Array<{ id: string; data: string }>;

            if (messageRows.length === 0) {
              return [];
            }

            const partRows = db
              .prepare(
                `SELECT message_id, data FROM part
                 WHERE session_id = ?
                 ORDER BY time_created ASC, id ASC`,
              )
              .all(sessionID) as Array<{ message_id: string; data: string }>;

            const partsByMessage = new Map<string, Part[]>();
            for (const row of partRows) {
              const parsed = decodePart(JSON.parse(row.data));
              const list = partsByMessage.get(row.message_id);
              if (list) {
                list.push(parsed);
              } else {
                partsByMessage.set(row.message_id, [parsed]);
              }
            }

            return messageRows.map((row) => {
              const info = decodeMessageInfo(JSON.parse(row.data));
              return {
                info,
                parts: partsByMessage.get(row.id) ?? [],
              };
            });
          },
          catch: (cause) => new DatabaseError({ cause }),
        }),
    };
  }),
);
