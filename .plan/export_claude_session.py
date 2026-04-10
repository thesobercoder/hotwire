#!/usr/bin/env python3
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PROJECTS_DIR = Path.home() / ".claude/projects" / ("-" + str(REPO_ROOT).replace("/", "-").lstrip("-"))
JSONL = max(PROJECTS_DIR.glob("*.jsonl"), key=lambda p: p.stat().st_mtime)
OUT = Path(__file__).resolve().parent / "openwork-interview-claude.md"


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
