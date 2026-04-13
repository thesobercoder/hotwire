import type { DatabaseSync } from "node:sqlite";

import { Context } from "effect";

export class Database extends Context.Tag("@hotwire/db/Database")<
  Database,
  DatabaseSync
>() {}

export class DbFilePath extends Context.Tag("@hotwire/db/DbFilePath")<
  DbFilePath,
  string
>() {}
