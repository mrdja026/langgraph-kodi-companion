import * as path from "node:path";
import { z } from "zod/v4";
import { getConfig } from "../config.js";
import { createClient, checkConnection, addTorrent, searchTorrents, setGlobalTrackers, QbtError } from "./qbittorrent.js";

const config = getConfig();

const seriesSchema = z.object({
  series_name: z.string().min(1, "series_name is required"),
  seasons: z.number().int().min(1).optional().default(1),
  episodes_per_season: z.number().int().min(1).optional().default(3),
  magnet_urls: z.array(z.string()).optional(),
});

function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim();
}

export type SeriesArgs = z.infer<typeof seriesSchema>;

export async function downloadAndFormatSeries(args: SeriesArgs): Promise<{ content: { type: "text"; text: string }[] }> {
  const { series_name, seasons, magnet_urls } = seriesSchema.parse(args);

  if (!config.mediaRoot) {
    throw new Error("MEDIA_ROOT is not configured");
  }

  const sanitized = sanitizeName(series_name);

  if (!magnet_urls || magnet_urls.length === 0) {
    let client;
    try {
      client = createClient();
      await checkConnection(client);
    } catch (err) {
      const message = err instanceof QbtError ? err.message : String(err);
      return { content: [{ type: "text", text: `Cannot search: ${message}` }] };
    }

    const lines: string[] = [
      `Searching qBittorrent for "${series_name}"...`,
      `\nFound magnets per season:\n`,
    ];
    const allMagnets: { magnetUrl: string; season: number }[] = [];

    for (let s = 1; s <= seasons; s++) {
      const query = `${series_name} S${String(s).padStart(2, "0")}`;
      const results = await searchTorrents(client, query, 1);
      if (results.length > 0) {
        const r = results[0];
        lines.push(`  ${query}: "${r.title}" (${r.seeders} seeders, ${r.size})`);
        allMagnets.push({ magnetUrl: r.magnetUrl, season: s });
      } else {
        lines.push(`  ${query}: no results found`);
      }
    }

    if (allMagnets.length > 0) {
      const magnetList = allMagnets.map((m) => `"${m.magnetUrl}"`).join(",\n    ");
      lines.push(
        `\nTo start downloading, call this tool again with:\n` +
          `  download_and_format_series({\n` +
          `    series_name: "${series_name}",\n` +
          `    seasons: ${seasons},\n` +
          `    magnet_urls: [\n    ${magnetList}\n    ]\n` +
          `  })`,
      );
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }

  let client;
  try {
    client = createClient();
    await checkConnection(client);
    await setGlobalTrackers(client);
  } catch (err) {
    const message = err instanceof QbtError ? err.message : String(err);
    return { content: [{ type: "text", text: message }] };
  }

  const results: { season: number; magnetUrl: string; status: string }[] = [];
  const magnetsPerSeason = Math.max(1, Math.ceil(magnet_urls.length / seasons));

  for (let s = 1; s <= seasons; s++) {
    const seasonStr = `S${String(s).padStart(2, "0")}`;
    const seasonMagnets = magnet_urls.slice((s - 1) * magnetsPerSeason, s * magnetsPerSeason);
    const savePath = path.resolve(config.mediaRoot, sanitized, `Season ${seasonStr}`);

    for (const magnetUrl of seasonMagnets) {
      try {
        await addTorrent(client, magnetUrl, savePath);
        results.push({ season: s, magnetUrl, status: "Added to qBittorrent" });
      } catch (err) {
        const message = err instanceof QbtError ? err.message : String(err);
        results.push({ season: s, magnetUrl, status: `Failed: ${message}` });
      }
    }
  }

  const lines: string[] = [`Results for "${series_name}" (sanitized: "${sanitized}"):`];
  for (const r of results) {
    const seasonStr = `S${String(r.season).padStart(2, "0")}`;
    const shortUrl = r.magnetUrl.length > 60 ? r.magnetUrl.slice(0, 60) + "..." : r.magnetUrl;
    lines.push(`  ${seasonStr}: ${shortUrl} — ${r.status}`);
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

export { seriesSchema };
