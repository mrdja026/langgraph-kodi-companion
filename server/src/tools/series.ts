import * as path from "node:path";
import { z } from "zod/v4";
import { getConfig } from "../config.js";
import { createClient, checkConnection, addTorrent, searchTorrents, setGlobalTrackers, QbtError } from "./qbittorrent.js";

const config = getConfig();
const MAX_SEARCH_RESULTS = 5;

const tvSeriesSchema = z.object({
  series_name: z.string().min(1, "series_name is required"),
  seasons: z.number().int().min(1).optional().default(1),
  magnet_urls: z.array(z.string()).optional(),
});

export function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim();
}

export type TvSeriesArgs = z.infer<typeof tvSeriesSchema>;

export async function searchAndDownloadTvSeries(args: TvSeriesArgs): Promise<{ content: { type: "text"; text: string }[] }> {
  const { series_name, seasons, magnet_urls } = tvSeriesSchema.parse(args);

  if (!config.mediaRoot) {
    throw new Error("MEDIA_ROOT is not configured");
  }

  const sanitized = sanitizeName(series_name);

  let client;
  try {
    client = createClient();
    await checkConnection(client);
  } catch (err) {
    const message = err instanceof QbtError ? err.message : String(err);
    return { content: [{ type: "text", text: `Cannot connect to qBittorrent: ${message}` }] };
  }

  // --- Auto-download flow (no magnet_urls provided) ---
  if (!magnet_urls || magnet_urls.length === 0) {
    await setGlobalTrackers(client);
    const lines: string[] = [`Searching and downloading "${series_name}"...\n`];
    let anySuccess = false;

    for (let s = 1; s <= seasons; s++) {
      const seasonStr = `S${String(s).padStart(2, "0")}`;
      const query = `${series_name} ${seasonStr}`;
      const savePath = path.resolve(config.mediaRoot, sanitized, `Season ${seasonStr}`);

      const results = await searchTorrents(client, query, MAX_SEARCH_RESULTS, "all");

      if (results.length === 0) {
        lines.push(`${seasonStr}: No results found for "${query}"`);
        continue;
      }

      let added = false;
      const attempts: { title: string; error: string }[] = [];

      for (const r of results) {
        try {
          const status = await addTorrent(client, r.magnetUrl, savePath);
          lines.push(`${seasonStr}: ${status} (${r.seeders} seeders, ${r.size})`);
          added = true;
          anySuccess = true;
          break;
        } catch (err) {
          const message = err instanceof QbtError ? err.message : String(err);
          attempts.push({ title: r.title, error: message });
        }
      }

      if (!added) {
        lines.push(`${seasonStr}: Failed all ${attempts.length} candidates:`);
        for (const a of attempts) {
          lines.push(`  - "${a.title}": ${a.error}`);
        }
      }
    }

    if (!anySuccess) {
      lines.push(`\nNo seasons could be downloaded for "${series_name}".`);
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }

  // --- Manual magnet flow (magnet_urls provided) ---
  await setGlobalTrackers(client);

  const results: { season: number; magnetUrl: string; status: string }[] = [];
  const magnetsPerSeason = Math.max(1, Math.ceil(magnet_urls.length / seasons));

  for (let s = 1; s <= seasons; s++) {
    const seasonStr = `S${String(s).padStart(2, "0")}`;
    const seasonMagnets = magnet_urls.slice((s - 1) * magnetsPerSeason, s * magnetsPerSeason);
    const savePath = path.resolve(config.mediaRoot, sanitized, `Season ${seasonStr}`);

    for (const magnetUrl of seasonMagnets) {
      try {
        const status = await addTorrent(client, magnetUrl, savePath);
        results.push({ season: s, magnetUrl, status });
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

export { tvSeriesSchema };
