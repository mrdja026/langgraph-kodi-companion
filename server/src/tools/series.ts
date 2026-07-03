import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod/v4";
import { getConfig } from "../config.js";
const config = getConfig();

const seriesSchema = z.object({
  series_name: z.string().min(1, "series_name is required"),
  seasons: z.number().int().min(1).optional().default(1),
  episodes_per_season: z.number().int().min(1).optional().default(3),
});

function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim();
}

export type SeriesArgs = z.infer<typeof seriesSchema>;

export async function downloadAndFormatSeries(args: SeriesArgs): Promise<{ content: { type: "text"; text: string }[] }> {
  const { series_name, seasons, episodes_per_season } = seriesSchema.parse(args);

  if (!config.mediaRoot) {
    throw new Error("MEDIA_ROOT is not configured");
  }

  const sanitized = sanitizeName(series_name);
  const baseDir = path.resolve(config.mediaRoot, sanitized);
  fs.mkdirSync(baseDir, { recursive: true });

  const createdPaths: string[] = [];

  for (let s = 1; s <= seasons; s++) {
    const seasonDir = path.join(baseDir, `Season ${String(s).padStart(2, "0")}`);
    fs.mkdirSync(seasonDir, { recursive: true });

    for (let e = 1; e <= episodes_per_season; e++) {
      const fileName = `S${String(s).padStart(2, "0")}E${String(e).padStart(2, "0")}.mp4`;
      const filePath = path.join(seasonDir, fileName);
      fs.writeFileSync(filePath, ""); // placeholder empty file
      createdPaths.push(filePath);
    }
  }

  return {
    content: [
      {
        type: "text",
        text: `Created placeholder files for "${series_name}" (sanitized: "${sanitized}"):\n${createdPaths.join("\n")}\n\nNOTE: These are placeholder files — no actual media was downloaded.`,
      },
    ],
  };
}

export { seriesSchema };
