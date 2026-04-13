import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SRC_DIR = join(import.meta.dirname, "..", "src");

const CREDENTIAL_LOG_PATTERNS = [
  /console\.(log|warn|error|info|debug)\s*\(.*api[_-]?key/i,
  /console\.(log|warn|error|info|debug)\s*\(.*apiKey/i,
  /console\.(log|warn|error|info|debug)\s*\(.*credential/i,
  /console\.(log|warn|error|info|debug)\s*\(.*secret/i,
  /console\.(log|warn|error|info|debug)\s*\(.*token/i,
];

function collectTsFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(full));
    } else if (entry.name.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

describe("credential audit", () => {
  it("no source file logs credential values", () => {
    const files = collectTsFiles(SRC_DIR);
    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        for (const pattern of CREDENTIAL_LOG_PATTERNS) {
          if (pattern.test(line)) {
            violations.push(`${file}:${i + 1}: ${line.trim()}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
