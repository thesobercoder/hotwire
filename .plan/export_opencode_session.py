#!/usr/bin/env python3
import json
import sqlite3
from pathlib import Path

DB = Path.home() / ".local/share/opencode/opencode.db"
SESSION_ID = "ses_293fd4bd9ffenS0NMAc1veaft6"
OUT = Path(__file__).resolve().parent / "openwork-interview-condensed.md"

con = sqlite3.connect(str(DB))
con.row_factory = sqlite3.Row

msgs = con.execute(
    "SELECT id, data FROM message WHERE session_id=? ORDER BY time_created",
    (SESSION_ID,),
).fetchall()

parts_by_msg: dict[str, list[sqlite3.Row]] = {}
for row in con.execute(
    "SELECT id, message_id, data FROM part WHERE session_id=? ORDER BY time_created",
    (SESSION_ID,),
).fetchall():
    parts_by_msg.setdefault(row["message_id"], []).append(row)


def render_text(p: sqlite3.Row) -> str:
    try:
        d = json.loads(p["data"])
    except Exception:
        return ""
    if d.get("type") == "text":
        text = d.get("text", "")
        text = text.encode("ascii", "ignore").decode("ascii")
        return text.strip()
    return ""


with open(OUT, "w") as f:
    f.write("# OpenWork-like app planning interview — condensed\n\n")
    f.write(f"Session: `{SESSION_ID}`  |  Messages: {len(msgs)}\n\n---\n\n")
    for i, m in enumerate(msgs, 1):
        role = json.loads(m["data"]).get("role", "?")
        pieces = [r for p in parts_by_msg.get(m["id"], []) if (r := render_text(p))]
        if not pieces:
            continue
        f.write(f"### [{i}] {role}\n\n")
        for p in pieces:
            f.write(p + "\n\n")
        f.write("---\n\n")

print(f"wrote {OUT}")
