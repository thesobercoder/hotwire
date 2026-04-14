import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { Effect, Either, Layer, Schema } from "effect";

import { initializeAppData } from "../src/app-data.js";
import { Database } from "../src/database.js";
import {
  AssistantMessage,
  MessageInfo,
  MessageRepo,
  MessageRepoLive,
  Part,
  ReasoningPart,
  TextPart,
  UserMessage,
  type MessageWithParts,
} from "../src/messages.js";

describe("Part schema", () => {
  it("decodes a TextPart with required fields", () => {
    const result = Schema.decodeUnknownEither(TextPart)({
      id: "01JTEST000000000000000PT1",
      sessionID: "01JTEST000000000000000SS1",
      messageID: "01JTEST000000000000000MS1",
      type: "text",
      text: "hello world",
    });

    expect(Either.isRight(result)).toBe(true);
  });

  it("accepts the optional synthetic, ignored, time, and metadata fields on TextPart", () => {
    const result = Schema.decodeUnknownEither(TextPart)({
      id: "01JTEST000000000000000PT1",
      sessionID: "01JTEST000000000000000SS1",
      messageID: "01JTEST000000000000000MS1",
      type: "text",
      text: "hi",
      synthetic: true,
      ignored: false,
      time: { start: 1700000000, end: 1700000010 },
      metadata: { foo: "bar" },
    });

    expect(Either.isRight(result)).toBe(true);
  });

  it("rejects a TextPart whose type is not 'text'", () => {
    const result = Schema.decodeUnknownEither(TextPart)({
      id: "01JTEST000000000000000PT1",
      sessionID: "01JTEST000000000000000SS1",
      messageID: "01JTEST000000000000000MS1",
      type: "reasoning",
      text: "hi",
    });

    expect(Either.isLeft(result)).toBe(true);
  });

  it("decodes a ReasoningPart with required fields including time.start", () => {
    const result = Schema.decodeUnknownEither(ReasoningPart)({
      id: "01JTEST000000000000000PT1",
      sessionID: "01JTEST000000000000000SS1",
      messageID: "01JTEST000000000000000MS1",
      type: "reasoning",
      text: "thinking...",
      time: { start: 1700000000 },
    });

    expect(Either.isRight(result)).toBe(true);
  });

  it("rejects a ReasoningPart missing the required time field", () => {
    const result = Schema.decodeUnknownEither(ReasoningPart)({
      id: "01JTEST000000000000000PT1",
      sessionID: "01JTEST000000000000000SS1",
      messageID: "01JTEST000000000000000MS1",
      type: "reasoning",
      text: "thinking...",
    });

    expect(Either.isLeft(result)).toBe(true);
  });

  it("Part union accepts both text and reasoning kinds via discriminator", () => {
    const text = Schema.decodeUnknownEither(Part)({
      id: "01JTEST000000000000000PT1",
      sessionID: "01JTEST000000000000000SS1",
      messageID: "01JTEST000000000000000MS1",
      type: "text",
      text: "hi",
    });
    const reasoning = Schema.decodeUnknownEither(Part)({
      id: "01JTEST000000000000000PT2",
      sessionID: "01JTEST000000000000000SS1",
      messageID: "01JTEST000000000000000MS1",
      type: "reasoning",
      text: "because",
      time: { start: 1700000000 },
    });

    expect(Either.isRight(text)).toBe(true);
    expect(Either.isRight(reasoning)).toBe(true);
  });
});

const userMessageFixture = {
  id: "01JTEST000000000000000MS1",
  sessionID: "01JTEST000000000000000SS1",
  role: "user" as const,
  time: { created: 1700000000 },
  agent: "general",
  model: { providerID: "anthropic", modelID: "claude-sonnet-4-20250514" },
};

const assistantMessageFixture = {
  id: "01JTEST000000000000000MS2",
  sessionID: "01JTEST000000000000000SS1",
  role: "assistant" as const,
  time: { created: 1700000001 },
  parentID: "01JTEST000000000000000MS1",
  modelID: "claude-sonnet-4-20250514",
  providerID: "anthropic",
  mode: "chat",
  agent: "general",
  path: { cwd: "/tmp/root", root: "/tmp/root" },
  cost: 0,
  tokens: {
    input: 0,
    output: 0,
    reasoning: 0,
    cache: { read: 0, write: 0 },
  },
};

describe("Message info schemas", () => {
  it("decodes a minimal UserMessage with required opencode-parity fields", () => {
    const result = Schema.decodeUnknownEither(UserMessage)(userMessageFixture);
    expect(Either.isRight(result)).toBe(true);
  });

  it("accepts optional format, summary, system, and tools on UserMessage", () => {
    const result = Schema.decodeUnknownEither(UserMessage)({
      ...userMessageFixture,
      format: { type: "text" },
      summary: { title: "summary", body: "body text", diffs: [] },
      system: "you are a helpful assistant",
      tools: { read: true, write: false },
    });
    expect(Either.isRight(result)).toBe(true);
  });

  it("rejects a UserMessage whose role is not 'user'", () => {
    const result = Schema.decodeUnknownEither(UserMessage)({
      ...userMessageFixture,
      role: "assistant",
    });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("decodes a minimal AssistantMessage with required opencode-parity fields", () => {
    const result = Schema.decodeUnknownEither(AssistantMessage)(
      assistantMessageFixture,
    );
    expect(Either.isRight(result)).toBe(true);
  });

  it("rejects an AssistantMessage missing the tokens block", () => {
    const withoutTokens: Record<string, unknown> = { ...assistantMessageFixture };
    delete withoutTokens["tokens"];
    const result = Schema.decodeUnknownEither(AssistantMessage)(withoutTokens);
    expect(Either.isLeft(result)).toBe(true);
  });

  it("MessageInfo union decodes both user and assistant via role discriminator", () => {
    const user = Schema.decodeUnknownEither(MessageInfo)(userMessageFixture);
    const assistant = Schema.decodeUnknownEither(MessageInfo)(
      assistantMessageFixture,
    );
    expect(Either.isRight(user)).toBe(true);
    expect(Either.isRight(assistant)).toBe(true);
  });
});

function createTestLayer() {
  const homeDir = mkdtempSync(join(tmpdir(), "hotwire-messages-"));
  const { dbPath } = Effect.runSync(initializeAppData({ homeDir }));
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  const DatabaseTest = Layer.succeed(Database, db);
  return {
    layer: MessageRepoLive.pipe(Layer.provide(DatabaseTest)),
    db,
  };
}

const run = <A>(
  layer: Layer.Layer<MessageRepo>,
  effect: Effect.Effect<A, unknown, MessageRepo>,
): A => Effect.runSync(Effect.provide(effect, layer));

describe("MessageRepo", () => {
  it("listBySession returns an empty array for an unknown session", () => {
    const { layer, db } = createTestLayer();

    const messages = run(
      layer,
      Effect.gen(function* () {
        const repo = yield* MessageRepo;
        return yield* repo.listBySession("01JTEST000000000000000SS9");
      }),
    );

    expect(messages).toEqual([]);
    db.close();
  });

  it("persists a UserMessage and reads it back through listBySession", () => {
    const { layer, db } = createTestLayer();

    const result = run(
      layer,
      Effect.gen(function* () {
        const repo = yield* MessageRepo;
        yield* repo.create(userMessageFixture);
        return yield* repo.listBySession(userMessageFixture.sessionID);
      }),
    );

    expect(result).toHaveLength(1);
    const only = result[0] as MessageWithParts;
    expect(only.info.role).toBe("user");
    expect(only.info.id).toBe(userMessageFixture.id);
    expect(only.parts).toEqual([]);
    db.close();
  });

  it("appendPart associates a TextPart with its message in listBySession", () => {
    const { layer, db } = createTestLayer();

    const result = run(
      layer,
      Effect.gen(function* () {
        const repo = yield* MessageRepo;
        yield* repo.create(userMessageFixture);
        yield* repo.appendPart({
          id: "01JTEST000000000000000PT1",
          messageID: userMessageFixture.id,
          sessionID: userMessageFixture.sessionID,
          type: "text",
          text: "hello",
        });
        return yield* repo.listBySession(userMessageFixture.sessionID);
      }),
    );

    expect(result).toHaveLength(1);
    const only = result[0] as MessageWithParts;
    expect(only.parts).toHaveLength(1);
    const part = only.parts[0];
    expect(part?.type).toBe("text");
    if (part?.type === "text") {
      expect(part.text).toBe("hello");
    }
    db.close();
  });

  it("orders messages by time_created ascending across a session", () => {
    const { layer, db } = createTestLayer();

    const second = {
      ...assistantMessageFixture,
      sessionID: userMessageFixture.sessionID,
      time: { created: userMessageFixture.time.created + 1 },
    };

    const result = run(
      layer,
      Effect.gen(function* () {
        const repo = yield* MessageRepo;
        // insert assistant first, user second — repo orders by time_created
        yield* repo.create(second);
        yield* repo.create(userMessageFixture);
        return yield* repo.listBySession(userMessageFixture.sessionID);
      }),
    );

    expect(result.map((m) => m.info.role)).toEqual(["user", "assistant"]);
    db.close();
  });

  it("groups parts under the correct message across two messages in one session", () => {
    const { layer, db } = createTestLayer();

    const assistantSameSession = {
      ...assistantMessageFixture,
      sessionID: userMessageFixture.sessionID,
    };

    const result = run(
      layer,
      Effect.gen(function* () {
        const repo = yield* MessageRepo;
        yield* repo.create(userMessageFixture);
        yield* repo.create(assistantSameSession);
        yield* repo.appendPart({
          id: "01JTEST000000000000000PT1",
          messageID: userMessageFixture.id,
          sessionID: userMessageFixture.sessionID,
          type: "text",
          text: "user says hi",
        });
        yield* repo.appendPart({
          id: "01JTEST000000000000000PT2",
          messageID: assistantSameSession.id,
          sessionID: assistantSameSession.sessionID,
          type: "text",
          text: "assistant replies",
        });
        return yield* repo.listBySession(userMessageFixture.sessionID);
      }),
    );

    expect(result).toHaveLength(2);
    const userRow = result.find((m) => m.info.role === "user");
    const assistantRow = result.find((m) => m.info.role === "assistant");
    expect(userRow?.parts).toHaveLength(1);
    expect(assistantRow?.parts).toHaveLength(1);
    const userPart = userRow?.parts[0];
    const assistantPart = assistantRow?.parts[0];
    if (userPart?.type === "text") {
      expect(userPart.text).toBe("user says hi");
    }
    if (assistantPart?.type === "text") {
      expect(assistantPart.text).toBe("assistant replies");
    }
    db.close();
  });
});
