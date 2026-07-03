import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod/v4";
import { getConfig } from "../config.js";
const config = getConfig();

const watchlistSchema = z.object({
  directory_path: z.string().default(""),
});

function resolveSafe(base: string, requested: string): string {
  const resolved = path.resolve(base, requested);
  if (!resolved.startsWith(path.resolve(base))) {
    throw new Error(`Path traversal denied: ${requested} escapes ${base}`);
  }
  return resolved;
}

export type WatchlistArgs = z.infer<typeof watchlistSchema>;

function readDirContents(dir: string, label: string): { type: "text"; text: string }[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const parts: string[] = [];

  for (const entry of entries) {
    if (entry.isFile()) {
      const filePath = path.join(dir, entry.name);
      const content = fs.readFileSync(filePath, "utf-8");
      parts.push(`--- ${entry.name} ---\n${content}`);
    }
  }

  if (parts.length === 0) {
    return [{ type: "text", text: `No files found in: ${label}` }];
  }

  return [{ type: "text", text: parts.join("\n\n") }];
}

export async function readWatchlist(args: WatchlistArgs): Promise<{ content: { type: "text"; text: string }[] }> {
  const { directory_path } = watchlistSchema.parse(args);

  if (!config.watchlistRoot) {
    throw new Error("WATCHLIST_ROOT is not configured");
  }

  const dirPath = directory_path || ".";
  const targetDir = resolveSafe(config.watchlistRoot, dirPath);

  if (fs.existsSync(targetDir)) {
    return { content: readDirContents(targetDir, directory_path) };
  }

  // Fallback: small models often invent bad paths (e.g., "~/watchlist");
  // read the root directory instead of failing.
  const rootDir = resolveSafe(config.watchlistRoot, ".");
  if (fs.existsSync(rootDir)) {
    return { content: readDirContents(rootDir, directory_path) };
  }

  return {
    content: [{ type: "text", text: `Directory not found: ${directory_path}` }],
  };
}

export { watchlistSchema };
