import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const tmpDir = path.join(os.tmpdir(), "mcp-test-" + Date.now());
const watchlistDir = path.join(tmpDir, "watchlist");
const mediaDir = path.join(tmpDir, "media");

let readWatchlist: typeof import("../src/tools/watchlist.js")["readWatchlist"];
let watchlistSchema: typeof import("../src/tools/watchlist.js")["watchlistSchema"];
let downloadAndFormatSeries: typeof import("../src/tools/series.js")["downloadAndFormatSeries"];
let seriesSchema: typeof import("../src/tools/series.js")["seriesSchema"];

const mockSearchTorrents = vi.fn();
const mockSetGlobalTrackers = vi.fn();
const mockCreateClient = vi.fn();
const mockCheckConnection = vi.fn();
const mockAddTorrent = vi.fn();

vi.mock("../src/tools/qbittorrent.js", () => ({
  createClient: mockCreateClient,
  checkConnection: mockCheckConnection,
  addTorrent: mockAddTorrent,
  searchTorrents: mockSearchTorrents,
  setGlobalTrackers: mockSetGlobalTrackers,
  QbtError: class extends Error {
    constructor(m: string) {
      super(m);
      this.name = "QbtError";
    }
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateClient.mockReturnValue({});
  mockCheckConnection.mockResolvedValue("v5.2.2");
  mockAddTorrent.mockResolvedValue("Ok.");
  mockSearchTorrents.mockResolvedValue([]);
  mockSetGlobalTrackers.mockResolvedValue(undefined);
});

beforeAll(async () => {
  fs.mkdirSync(watchlistDir, { recursive: true });
  fs.mkdirSync(mediaDir, { recursive: true });

  process.env.WATCHLIST_ROOT = watchlistDir;
  process.env.MEDIA_ROOT = mediaDir;

  const watchlist = await import("../src/tools/watchlist.js");
  readWatchlist = watchlist.readWatchlist;
  watchlistSchema = watchlist.watchlistSchema;

  const series = await import("../src/tools/series.js");
  downloadAndFormatSeries = series.downloadAndFormatSeries;
  seriesSchema = series.seriesSchema;
});

describe("watchlistSchema", () => {
  it("accepts valid directory_path", () => {
    const result = watchlistSchema.parse({ directory_path: "movies/tv shows to watch" });
    expect(result.directory_path).toBe("movies/tv shows to watch");
  });

  it("defaults empty directory_path to ''", () => {
    const result = watchlistSchema.parse({ directory_path: "" });
    expect(result.directory_path).toBe("");
  });

  it("defaults missing directory_path to ''", () => {
    const result = watchlistSchema.parse({});
    expect(result.directory_path).toBe("");
  });
});

describe("readWatchlist", () => {
  it("rejects path traversal", async () => {
    await expect(
      readWatchlist({ directory_path: "..\\..\\windows" }),
    ).rejects.toThrow("Path traversal denied");
  });

  it("falls back to root when requested directory does not exist", async () => {
    const result = await readWatchlist({ directory_path: "nonexistent-dir" });
    expect(result.content[0].text).toContain("No files found");
  });
});

describe("seriesSchema", () => {
  it("accepts valid series input with magnet_urls", () => {
    const result = seriesSchema.parse({
      series_name: "Dark",
      seasons: 1,
      magnet_urls: ["magnet:?xt=urn:btih:abc123"],
    });
    expect(result.series_name).toBe("Dark");
    expect(result.magnet_urls).toEqual(["magnet:?xt=urn:btih:abc123"]);
  });

  it("accepts series input without magnet_urls", () => {
    const result = seriesSchema.parse({ series_name: "Test" });
    expect(result.seasons).toBe(1);
    expect(result.magnet_urls).toBeUndefined();
  });

  it("rejects missing series_name", () => {
    expect(() => seriesSchema.parse({})).toThrow();
  });

  it("rejects empty series_name", () => {
    expect(() => seriesSchema.parse({ series_name: "" })).toThrow();
  });
});

describe("downloadAndFormatSeries", () => {
  it("auto-searches via qBittorrent when no magnet_urls provided", async () => {
    mockSearchTorrents.mockResolvedValue([
      { magnetUrl: "magnet:?xt=urn:btih:abc", title: "Dark S01", seeders: 50, size: "2 GiB" },
    ]);

    const result = await downloadAndFormatSeries({
      series_name: "Dark",
      seasons: 1,
    });

    expect(result.content[0].text).toContain("Searching qBittorrent");
    expect(result.content[0].text).toContain("Dark S01");
    expect(result.content[0].text).toContain("50 seeders");
    expect(result.content[0].text).toContain("download_and_format_series");
    expect(mockCreateClient).toHaveBeenCalled();
    expect(mockCheckConnection).toHaveBeenCalled();
    expect(mockSearchTorrents).toHaveBeenCalledWith(expect.anything(), "Dark S01", 1);
  });

  it("reports no results when qBittorrent search finds nothing", async () => {
    mockSearchTorrents.mockResolvedValue([]);

    const result = await downloadAndFormatSeries({
      series_name: "Dark",
      seasons: 2,
    });

    expect(result.content[0].text).toContain("no results found");
  });

  it("returns connection error if qBittorrent is unreachable during search", async () => {
    mockCheckConnection.mockRejectedValueOnce(new Error("Could not connect"));

    const result = await downloadAndFormatSeries({
      series_name: "Dark",
      seasons: 1,
    });

    expect(result.content[0].text).toContain("Cannot search");
  });

  it("adds magnet URLs to qBittorrent when provided", async () => {
    const result = await downloadAndFormatSeries({
      series_name: "Dark",
      magnet_urls: ["magnet:?xt=urn:btih:abc"],
    });

    expect(result.content[0].text).toContain('Results for "Dark"');
    expect(result.content[0].text).toContain("Added to qBittorrent");
    expect(mockAddTorrent).toHaveBeenCalled();
    expect(mockSetGlobalTrackers).toHaveBeenCalled();
  });

  it("distributes magnets across seasons", async () => {
    await downloadAndFormatSeries({
      series_name: "Dark",
      seasons: 2,
      magnet_urls: [
        "magnet:?xt=urn:btih:s01e01",
        "magnet:?xt=urn:btih:s01e02",
        "magnet:?xt=urn:btih:s02e01",
        "magnet:?xt=urn:btih:s02e02",
      ],
    });

    expect(mockAddTorrent).toHaveBeenCalledTimes(4);
  });

  it("sanitizes problematic characters in series name", async () => {
    const result = await downloadAndFormatSeries({
      series_name: "Dark: The Series",
      magnet_urls: ["magnet:?xt=urn:btih:abc"],
    });

    expect(result.content[0].text).toContain("sanitized");
    expect(result.content[0].text).toContain("Dark_ The Series");
  });

  it("returns error when qBittorrent connection fails", async () => {
    mockCheckConnection.mockRejectedValueOnce(
      new Error("Could not connect to qBittorrent at localhost:8080"),
    );

    const result = await downloadAndFormatSeries({
      series_name: "Dark",
      magnet_urls: ["magnet:?xt=urn:btih:abc"],
    });

    expect(result.content[0].text).toContain("Could not connect");
  });

  it("reports when a magnet add fails", async () => {
    mockAddTorrent.mockRejectedValueOnce(new Error("Invalid magnet"));

    const result = await downloadAndFormatSeries({
      series_name: "Dark",
      magnet_urls: ["magnet:?xt=urn:btih:bad"],
    });

    expect(result.content[0].text).toContain("Failed");
  });

  it("sets global trackers on every download", async () => {
    await downloadAndFormatSeries({
      series_name: "Dark",
      magnet_urls: ["magnet:?xt=urn:btih:abc"],
    });

    expect(mockSetGlobalTrackers).toHaveBeenCalledTimes(1);
    expect(mockSetGlobalTrackers).toHaveBeenCalledWith({});
  });
});
