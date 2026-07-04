import { qBittorrentClient } from "@robertklep/qbittorrent";
import { getConfig } from "../config.js";

const config = getConfig();

export class QbtError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QbtError";
  }
}

export interface TorrentResult {
  magnetUrl: string;
  title: string;
  seeders: number;
  size: string;
}

const TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://tracker.moeking.me:6969/announce",
  "udp://exodus.desync.com:6969/announce",
  "udp://tracker.cyberia.is:6969/announce",
  "https://tracker.renfei.net:443/announce",
  "http://tracker.openbittorrent.com:80/announce",
];

export function createClient(): qBittorrentClient {
  const url = `http://${config.qbtHost}:${config.qbtPort}`;
  const client = new qBittorrentClient(url, config.qbtUsername, config.qbtPassword);
  return client;
}

export async function checkConnection(client: qBittorrentClient): Promise<string> {
  try {
    const version = await client.app.version();
    return version as string;
  } catch {
    throw new QbtError(
      `Could not connect to qBittorrent at ${config.qbtHost}:${config.qbtPort}. ` +
        "Ensure qBittorrent is running with Web UI enabled (Tools → Preferences → Web UI).",
    );
  }
}

export async function addTorrent(
  client: qBittorrentClient,
  magnetUrl: string,
  savePath: string,
): Promise<string> {
  try {
    const result = await client.torrents.add({ urls: magnetUrl, savepath: savePath } as any);
    return String(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new QbtError(`Failed to add torrent to qBittorrent: ${message}`);
  }
}

export async function setGlobalTrackers(client: qBittorrentClient): Promise<void> {
  try {
    await client.app.setPreferences({
      add_trackers_enabled: true,
      add_trackers: TRACKERS.join("\n"),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new QbtError(`Failed to set global trackers: ${message}`);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const EXCLUDED_SITE_PATTERNS = [
  "academic", "acg.rip", "anidex", "anime",
];

function isBlocklistedSite(siteUrl: string): boolean {
  const lower = siteUrl.toLowerCase();
  return EXCLUDED_SITE_PATTERNS.some((p) => lower.includes(p));
}

export async function searchTorrents(
  client: qBittorrentClient,
  query: string,
  maxResults = 3,
): Promise<TorrentResult[]> {
  let searchId: number;
  try {
    searchId = await client.search.start(query, "all");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new QbtError(`Failed to start qBittorrent search: ${message}`);
  }

  const pollIntervalMs = 1500;
  const timeoutMs = 30000;
  const deadline = Date.now() + timeoutMs;
  let lastTotal = -1;
  let stablePolls = 0;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    const status = await client.search.status(searchId);
    const st = Array.isArray(status) ? status[0] : status;
    if (!st) break;
    if (st.status !== "Running") break;

    if (st.total === lastTotal) {
      stablePolls++;
      if (stablePolls >= 3) break;
    } else {
      stablePolls = 0;
      lastTotal = st.total;
    }
  }

  let results: TorrentResult[] = [];
  try {
    const raw = await client.search.results(searchId, 0, 0);
    results = (raw as any[])
      .filter((r: any) => !isBlocklistedSite(r.siteUrl))
      .map((r: any) => ({
        magnetUrl: r.fileUrl,
        title: r.fileName,
        seeders: r.nbSeeders,
        size: formatBytes(r.fileSize),
      }))
      .sort((a, b) => b.seeders - a.seeders)
      .slice(0, maxResults);
  } catch {
  }

  try {
    await client.search.delete(searchId);
  } catch {
  }

  return results;
}
