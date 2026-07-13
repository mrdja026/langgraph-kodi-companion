import { z } from "zod/v4";
import { createClient, checkConnection, QbtError } from "./qbittorrent.js";

const completedDownloadsSchema = z.object({});

export type CompletedDownloadsArgs = z.infer<typeof completedDownloadsSchema>;

function inferType(name: string, savePath: string): "movie" | "tv" | "unknown" {
  const lowerName = name.toLowerCase();
  const lowerPath = savePath.toLowerCase();
  if (lowerPath.includes("movies") || lowerPath.includes("\\movie\\") || lowerPath.includes("/movie/")) {
    return "movie";
  }
  if (lowerPath.includes("season") || lowerName.includes(" s0")) {
    return "tv";
  }
  return "unknown";
}

function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export async function scanCompletedDownloads(): Promise<{ content: { type: "text"; text: string }[] }> {
  let client;
  try {
    client = createClient();
    await checkConnection(client);
  } catch (err) {
    const message = err instanceof QbtError ? err.message : String(err);
    return { content: [{ type: "text", text: `Cannot connect to qBittorrent: ${message}` }] };
  }

  let torrents: Record<string, unknown>[];
  try {
    torrents = (await client.torrents.info()) as Record<string, unknown>[];
  } catch (err) {
    const message = err instanceof QbtError ? err.message : String(err);
    return { content: [{ type: "text", text: `Failed to fetch torrents: ${message}` }] };
  }

  const completed = torrents
    .filter((t) => t.progress === 1)
    .sort((a, b) => (b.completion_on as number) - (a.completion_on as number));

  if (completed.length === 0) {
    return { content: [{ type: "text", text: "No completed downloads found." }] };
  }

  const lines: string[] = [`Found ${completed.length} completed download${completed.length !== 1 ? "s" : ""}:`, ""];
  for (const t of completed) {
    const name = String(t.name ?? "?");
    const savePath = String(t.save_path ?? "");
    const totalSize = Number(t.total_size ?? 0);
    const completionOn = Number(t.completion_on ?? 0);
    const date = completionOn > 0 ? new Date(completionOn * 1000).toISOString().slice(0, 10) : "?";
    const type = inferType(name, savePath);
    lines.push(`  ${name}`);
    lines.push(`     Size: ${formatSize(totalSize)}  |  Completed: ${date}  |  Type: ${type}`);
    lines.push(`     Path: ${savePath}`);
    lines.push("");
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

export { completedDownloadsSchema };
