import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod/v4";

const MEDIA_ROOT = "C:/Users/Mrdjan/Documents/workspace/fable_playing/langgraph-automation/test-fixtures/media";

const mediaLibrarySchema = z.object({});

export type MediaLibraryArgs = z.infer<typeof mediaLibrarySchema>;

function cleanName(dirName: string): string {
  return dirName
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countSeasonsAndEpisodes(showDir: string): { seasons: number; episodes: number } {
  const items = fs.readdirSync(showDir, { withFileTypes: true });
  const seasonDirs = items.filter((e) => e.isDirectory());
  let episodes = 0;
  for (const s of seasonDirs) {
    const seasonPath = path.join(showDir, s.name);
    const files = fs.readdirSync(seasonPath, { withFileTypes: true });
    episodes += files.filter((f) => f.isFile()).length;
  }
  return { seasons: seasonDirs.length, episodes };
}

export async function scanMediaLibrary(): Promise<{ content: { type: "text"; text: string }[] }> {
  if (!fs.existsSync(MEDIA_ROOT)) {
    return {
      content: [{ type: "text", text: `Media library not found at: ${MEDIA_ROOT}` }],
    };
  }

  const topDirs = fs.readdirSync(MEDIA_ROOT, { withFileTypes: true }).filter((e) => e.isDirectory());
  const parts: string[] = [];

  for (const category of topDirs) {
    const catPath = path.join(MEDIA_ROOT, category.name);
    const label = category.name.toLowerCase() === "tv" ? "TV Series" : category.name;

    const items = fs.readdirSync(catPath, { withFileTypes: true }).filter((e) => e.isDirectory());

    if (items.length === 0) {
      parts.push(`=== ${label} ===\n  (empty)`);
      continue;
    }

    const lines: string[] = [`=== ${label} ===`];
    for (const item of items) {
      if (category.name.toLowerCase() === "tv") {
        const { seasons, episodes } = countSeasonsAndEpisodes(path.join(catPath, item.name));
        lines.push(`  - ${cleanName(item.name)} (${seasons} season${seasons !== 1 ? "s" : ""}, ${episodes} episode${episodes !== 1 ? "s" : ""})`);
      } else {
        lines.push(`  - ${cleanName(item.name)}`);
      }
    }
    parts.push(lines.join("\n"));
  }

  if (parts.length === 0) {
    return {
      content: [{ type: "text", text: "Media library is empty." }],
    };
  }

  return {
    content: [{ type: "text", text: `Your media library contains:\n\n${parts.join("\n\n")}` }],
  };
}

export { mediaLibrarySchema };
