#!/usr/bin/env python3
import json
from pathlib import Path

JSONL = Path(
    "/home/thesobercoder/.claude/projects/-home-thesobercoder-projects-hotwire/f4a57e34-d601-4e8a-9196-e9f7af286fe7.jsonl"
)
OUT = Path("/home/thesobercoder/projects/hotwire/.plan/openwork-interview-claude.md")


def ascii_clean(s: str) -> str:
    return s.encode("ascii", "ignore").decode("ascii").strip()


def extract_text(content) -> str:
    if isinstance(content, str):
        return ascii_clean(content)
    if isinstance(content, list):
        parts = []
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "text":
                parts.append(ascii_clean(block.get("text", "")))
        return "\n\n".join(p for p in parts if p)
    return ""


def is_tool_result_only(content) -> bool:
    if not isinstance(content, list):
        return False
    return all(isinstance(b, dict) and b.get("type") == "tool_result" for b in content)


rows = []
with JSONL.open() as f:
    for line in f:
        try:
            d = json.loads(line)
        except Exception:
            continue
        t = d.get("type")
        if t not in ("user", "assistant"):
            continue
        msg = d.get("message", {})
        content = msg.get("content")
        if t == "user" and is_tool_result_only(content):
            continue
        text = extract_text(content)
        if not text:
            continue
        rows.append((t, text))

with OUT.open("w") as f:
    f.write("# OpenWork-like app planning interview - continuation\n\n")
    f.write("Continued in Claude Code from the opencode transcript.\n\n---\n\n")
    for i, (role, text) in enumerate(rows, 1):
        f.write(f"### [{i}] {role}\n\n{text}\n\n---\n\n")

print(f"wrote {len(rows)} messages to {OUT}")
