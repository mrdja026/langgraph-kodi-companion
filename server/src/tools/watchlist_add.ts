import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod/v4";
import { getConfig } from "../config.js";
import { sanitizeName } from "./series.js";

const config = getConfig();

const watchlistAddSchema = z.object({
  title: z.string().min(1, "title is required"),
  year: z.number().int().optional(),
  type: z.enum(["movie", "tv"]),
  imdb_url: z.string().optional(),
  genre: z.string().optional(),
  status: z.string().optional().default("downloaded"),
  overwrite: z.boolean().optional().default(false),
});

export type WatchlistAddArgs = z.infer<typeof watchlistAddSchema>;

function resolveSafe(base: string, requested: string): string {
  const resolved = path.resolve(base, requested);
  if (!resolved.startsWith(path.resolve(base))) {
    throw new Error(`Path traversal denied: ${requested} escapes ${base}`);
  }
  return resolved;
}

function toYamlValue(value: unknown): string {
  if (typeof value === "string" && /[:\n#"',{}\[\]]/.test(value)) {
    return JSON.stringify(value);
  }
  return String(value);
}

function buildFrontmatter(args: WatchlistAddArgs): string {
  const now = new Date();
  const dateAdded = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const fields: Record<string, unknown> = {
    title: args.title,
    type: args.type,
    date_added: dateAdded,
  };
  if (args.year !== undefined) fields.year = args.year;
  if (args.imdb_url) fields.imdb_url = args.imdb_url;
  if (args.genre) fields.genre = args.genre;
  if (args.status) fields.status = args.status;

  const lines = ["---"];
  for (const [key, value] of Object.entries(fields)) {
    lines.push(`${key}: ${toYamlValue(value)}`);
  }
  lines.push("---\n");
  return lines.join("\n");
}

export async function addToWatchlist(args: WatchlistAddArgs): Promise<{ content: { type: "text"; text: string }[] }> {
  const parsed = watchlistAddSchema.parse(args);
  const { title, type } = parsed;

  if (!config.watchlistRoot) {
    throw new Error("WATCHLIST_ROOT is not configured");
  }

  const sanitized = sanitizeName(title);
  const subDir = type === "movie" ? "movie" : "tv";
  const targetDir = resolveSafe(config.watchlistRoot, subDir);
  const filePath = path.join(targetDir, `${sanitized}.md`);

  if (fs.existsSync(filePath) && !parsed.overwrite) {
    return {
      content: [{ type: "text", text: `Entry already exists: ${subDir}/${sanitized}.md. Use overwrite=true to replace it.` }],
    };
  }

  fs.mkdirSync(targetDir, { recursive: true });

  const frontmatter = buildFrontmatter(parsed);
  fs.writeFileSync(filePath, frontmatter, "utf-8");

  return {
    content: [{ type: "text", text: `Added to watchlist: ${subDir}/${sanitized}.md` }],
  };
}

export { watchlistAddSchema };
