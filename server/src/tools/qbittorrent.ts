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

const BAD_TORRENT_STATES = new Set([
  "missingFiles", "error", "unknown",
]);

const TRACKERS = [
  "udp://tracker-udp.gbitt.info:80/announce",
  "http://ipv4announce.sktorrent.eu:6969/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "http://tracker.mywaifu.best:6969/announce",
  "udp://evan.im:6969/announce",
  "udp://bittorrent-tracker.e-n-c-r-y-p-t.net:1337/announce",
  "udp://martin-gebhardt.eu:25/announce",
  "udp://tracker.opentorrent.top:6969/announce",
  "udp://ns575949.ip-51-222-82.net:6969/announce",
  "udp://tracker.corpscorp.online:80/announce",
  "https://tracker.manager.v6.navy:443/announce",
  "https://orgtgju.org:443/announce",
  "https://banananetwork.qzz.io:443/announce",
  "https://021912.xyz:443/announce",
  "udp://mail.segso.net:6969/announce",
  "https://ht.therarbg.to:443/announce",
  "udp://tracker.peerfect.org:6969/announce",
  "udp://tracker.opentrackr.com:6969/announce",
  "udp://tracker.ilibr.org:6969/announce",
  "udp://tracker.dler.com:6969/announce",
  "https://tr.nyacat.pw:443/announce",
  "udp://tracker.bluefrog.pw:2710/announce",
  "udp://open.ftorrent.com:443/announce",
  "udp://tracker.aruku.ovh:8081/announce",
  "https://tracker.anibt.net:443/announce",
  "udp://tracker.qu.ax:6969/announce",
  "http://tracker.dhitechnical.com:6969/announce",
  "udp://anime-tracker.aruku.kro.kr:8081/announce",
  "http://wegkxfcivgx.ydns.eu:80/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.gmi.gd:6969/announce",
  "udp://tracker.teambelgium.net:6969/announce",
  "https://tracker.7471.top:443/announce",
  "https://tracker.leechshield.link:443/announce",
  "https://t.213891.xyz:443/announce",
  "https://torrents.tmtime.dev:443/announce",
  "udp://tracker.wildkat.net:6969/announce",
  "udp://tracker.trackarr.org:6969/announce",
  "udp://torrentclub.online:1984/announce",
  "http://bt1.archive.org:6969/announce",
  "http://bt2.archive.org:6969/announce",
  "http://tracker.xn--djrq4gl4hvoi.top:80/announce",
  "http://tracker.waaa.moe:6969/announce",
  "https://004430.xyz:443/announce",
  "https://tracker.nekomi.cn:443/announce",
  "http://tracker.renfei.net:8080/announce",
  "http://tracker.bt4g.com:2095/announce",
  "udp://tracker.breizh.pm:6969/announce",
  "https://tracker.zhuqiy.com:443/announce",
  "udp://t.overflow.biz:6969/announce",
  "udp://tracker.hismz.cn:6969/announce",
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

/**
 * Extract the info hash from a magnet URL (btih value, lowercased).
 * Returns null if not found.
 */
export function extractInfoHash(magnetUrl: string): string | null {
  const match = magnetUrl.match(/btih:([a-fA-F0-9]{40})/i);
  return match ? match[1].toLowerCase() : null;
}

export async function addTorrent(
  client: qBittorrentClient,
  magnetUrl: string,
  savePath: string,
): Promise<string> {
  const hash = extractInfoHash(magnetUrl);
  console.log(`Adding torrent: ${hash ?? magnetUrl.slice(0, 60)}...`);

  try {
    const result = await client.torrents.add({ urls: magnetUrl, savepath: savePath } as any);
    const resultStr = String(result);

    // qBittorrent returns "Ok." even for duplicates or silent failures.
    // Verify the torrent actually exists if we have a hash.
    if (hash) {
      // Give qBittorrent a moment to register the torrent
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const torrents = await client.torrents.info({ hashes: hash } as any);
        const list = Array.isArray(torrents) ? torrents : [];
        if (list.length === 0) {
          console.warn(`Torrent ${hash} not found after add`);
          throw new QbtError(
            `qBittorrent reported "${resultStr}" but torrent ${hash} was not found. ` +
              "The magnet may be invalid or already removed.",
          );
        }
        const t = list[0] as Record<string, unknown>;
        const name = t.name ?? hash;
        const state = String(t.state ?? "unknown");
        console.log(`Verified: "${name}" (state: ${state})`);
        if (BAD_TORRENT_STATES.has(state)) {
          console.warn(`Torrent ${hash} has bad state: ${state}, skipping`);
          throw new QbtError(
            `Torrent ${hash} has bad state: ${state}, likely missing files or error.`,
          );
        }
        return `Added "${name}" (state: ${state})`;
      } catch (verifyErr) {
        if (verifyErr instanceof QbtError) throw verifyErr;
        // Verification API failed but add succeeded — report optimistically
        return resultStr;
      }
    }

    return resultStr;
  } catch (err) {
    if (err instanceof QbtError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to add torrent: ${message}`);
    throw new QbtError(`Failed to add torrent to qBittorrent: ${message}`);
  }
}

export async function setGlobalTrackers(client: qBittorrentClient): Promise<void> {
  try {
    await client.app.setPreferences({
      add_trackers_enabled: true,
      add_trackers: TRACKERS.join("\n"),
    });
    console.log(`Set ${TRACKERS.length} global trackers`);
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

const NON_VIDEO_EXTENSIONS = [
  ".pdf", ".epub", ".mobi", ".azw3", ".djvu",
  ".doc", ".docx", ".txt", ".rtf",
  ".zip", ".rar", ".7z", ".tar", ".gz",
  ".cbz", ".cbr", ".chm",
  ".exe", ".msi", ".iso",
  ".mp3", ".flac", ".wav", ".ogg", ".aac",
];

const EXCLUDED_SITE_PATTERNS = [
  "academic", "acg.rip", "anidex", "anime",
  "libgen", "sci-hub", "pdf", "ebook", "book",
  "library", "arxiv", "dblp",
];

export function isBlocklistedSite(siteUrl: string): boolean {
  const lower = siteUrl.toLowerCase();
  return EXCLUDED_SITE_PATTERNS.some((p) => lower.includes(p));
}

export function isNonVideoFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return NON_VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export async function searchTorrents(
  client: qBittorrentClient,
  query: string,
  maxResults = 3,
  category: string = "all",
): Promise<TorrentResult[]> {
  let searchId: number;
  try {
    searchId = await client.search.start(query, "all", category);
    console.log(`Searching: "${query}" (max ${maxResults}, category: ${category})`);
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
      .filter((r: any) => !isNonVideoFile(r.fileName))
      .map((r: any) => ({
        magnetUrl: r.fileUrl,
        title: r.fileName,
        seeders: r.nbSeeders,
        size: formatBytes(r.fileSize),
      }))
      .sort((a, b) => b.seeders - a.seeders)
      .slice(0, maxResults);
    console.log(`Found ${results.length} results for "${query}"`);
  } catch {
    console.error("Search result fail from QBittorrent")
  }

  try {
    await client.search.delete(searchId);
  } catch {
    console.error("Search result delete fail from QBittorrent")

  }
  return results;
}
