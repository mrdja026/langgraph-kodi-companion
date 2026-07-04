import * as path from "node:path";
import { z } from "zod/v4";
import { getConfig } from "../config.js";
import { createClient, checkConnection, addTorrent, searchTorrents, setGlobalTrackers, QbtError } from "./qbittorrent.js";
import { sanitizeName } from "./series.js";

const config = getConfig();
const MAX_SEARCH_RESULTS = 5;

const movieSchema = z.object({
  title: z.string().min(1, "title is required"),
  magnet_urls: z.array(z.string()).optional(),
});

export type MovieArgs = z.infer<typeof movieSchema>;

export async function searchAndDownloadMovie(args: MovieArgs): Promise<{ content: { type: "text"; text: string }[] }> {
  const { title, magnet_urls } = movieSchema.parse(args);

  if (!config.mediaRoot) {
    throw new Error("MEDIA_ROOT is not configured");
  }

  const sanitized = sanitizeName(title);
  const savePath = path.resolve(config.mediaRoot, "Movies", sanitized);

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

    const results = await searchTorrents(client, title, MAX_SEARCH_RESULTS, "all");

    if (results.length === 0) {
      return {
        content: [{ type: "text", text: `No results found for "${title}" in qBittorrent search.` }],
      };
    }

    const attempts: { title: string; error: string }[] = [];

    for (const r of results) {
      try {
        const status = await addTorrent(client, r.magnetUrl, savePath);
        return {
          content: [{
            type: "text",
            text: `Downloaded "${title}":\n  ${status} (${r.seeders} seeders, ${r.size})\n  Saved to: Movies/${sanitized}/`,
          }],
        };
      } catch (err) {
        const message = err instanceof QbtError ? err.message : String(err);
        attempts.push({ title: r.title, error: message });
      }
    }

    // All candidates failed
    const lines = [`Failed to download "${title}". Tried ${attempts.length} results:`];
    for (const a of attempts) {
      lines.push(`  - "${a.title}": ${a.error}`);
    }
    return { content: [{ type: "text", text: lines.join("\n") }] };
  }

  // --- Manual magnet flow (magnet_urls provided) ---
  await setGlobalTrackers(client);

  const addResults: { magnetUrl: string; status: string }[] = [];

  for (const magnetUrl of magnet_urls) {
    try {
      const status = await addTorrent(client, magnetUrl, savePath);
      addResults.push({ magnetUrl, status });
    } catch (err) {
      const message = err instanceof QbtError ? err.message : String(err);
      addResults.push({ magnetUrl, status: `Failed: ${message}` });
    }
  }

  const lines: string[] = [`Results for "${title}" (sanitized: "${sanitized}"):`];
  for (const r of addResults) {
    const shortUrl = r.magnetUrl.length > 60 ? r.magnetUrl.slice(0, 60) + "..." : r.magnetUrl;
    lines.push(`  ${shortUrl} — ${r.status}`);
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

export { movieSchema };
