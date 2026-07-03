import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod/v4";
import { getConfig } from "../config.js";
const config = getConfig();

const watchlistSchema = z.object({
  directory_path: z.string().min(1, "directory_path is required"),
});

function resolveSafe(base: string, requested: string): string {
  const resolved = path.resolve(base, requested);
  if (!resolved.startsWith(path.resolve(base))) {
    throw new Error(`Path traversal denied: ${requested} escapes ${base}`);
  }
  return resolved;
}

export type WatchlistArgs = z.infer<typeof watchlistSchema>;

export async function readWatchlist(args: WatchlistArgs): Promise<{ content: { type: "text"; text: string }[] }> {
  const { directory_path } = watchlistSchema.parse(args);

  if (!config.watchlistRoot) {
    throw new Error("WATCHLIST_ROOT is not configured");
  }

  const targetDir = resolveSafe(config.watchlistRoot, directory_path);

  if (!fs.existsSync(targetDir)) {
    return {
      content: [{ type: "text", text: `Directory not found: ${directory_path}` }],
    };
  }

  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  const parts: string[] = [];

  for (const entry of entries) {
    if (entry.isFile()) {
      const filePath = path.join(targetDir, entry.name);
      const content = fs.readFileSync(filePath, "utf-8");
      parts.push(`--- ${entry.name} ---\n${content}`);
    }
  }

  if (parts.length === 0) {
    return {
      content: [{ type: "text", text: `No files found in: ${directory_path}` }],
    };
  }

  return {
    content: [{ type: "text", text: parts.join("\n\n") }],
  };
}

export { watchlistSchema };
