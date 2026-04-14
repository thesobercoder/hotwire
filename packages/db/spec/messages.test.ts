import { Either, Schema } from "effect";

import { Part, ReasoningPart, TextPart } from "../src/messages.js";

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
