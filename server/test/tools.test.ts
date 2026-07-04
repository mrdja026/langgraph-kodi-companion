import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const tmpDir = path.join(os.tmpdir(), "mcp-test-" + Date.now());
const watchlistDir = path.join(tmpDir, "watchlist");
const mediaDir = path.join(tmpDir, "media");

let readWatchlist: typeof import("../src/tools/watchlist.js")["readWatchlist"];
let watchlistSchema: typeof import("../src/tools/watchlist.js")["watchlistSchema"];
let searchAndDownloadTvSeries: typeof import("../src/tools/series.js")["searchAndDownloadTvSeries"];
let tvSeriesSchema: typeof import("../src/tools/series.js")["tvSeriesSchema"];
let searchAndDownloadMovie: typeof import("../src/tools/movie.js")["searchAndDownloadMovie"];
let isNonVideoFile: (fileName: string) => boolean;
let isBlocklistedSite: (siteUrl: string) => boolean;

const mockSearchTorrents = vi.fn();
const mockSetGlobalTrackers = vi.fn();
const mockCreateClient = vi.fn();
const mockCheckConnection = vi.fn();
const mockAddTorrent = vi.fn();

vi.mock("../src/tools/qbittorrent.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/tools/qbittorrent.js")>();
  return {
    ...actual,
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
  };
});

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
  searchAndDownloadTvSeries = series.searchAndDownloadTvSeries;
  tvSeriesSchema = series.tvSeriesSchema;

  const movie = await import("../src/tools/movie.js");
  searchAndDownloadMovie = movie.searchAndDownloadMovie;

  const qbt = await import("../src/tools/qbittorrent.js");
  isNonVideoFile = qbt.isNonVideoFile;
  isBlocklistedSite = qbt.isBlocklistedSite;
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

describe("tvSeriesSchema", () => {
  it("accepts valid series input with magnet_urls", () => {
    const result = tvSeriesSchema.parse({
      series_name: "Dark",
      seasons: 1,
      magnet_urls: ["magnet:?xt=urn:btih:abc123"],
    });
    expect(result.series_name).toBe("Dark");
    expect(result.magnet_urls).toEqual(["magnet:?xt=urn:btih:abc123"]);
  });

  it("accepts series input without magnet_urls", () => {
    const result = tvSeriesSchema.parse({ series_name: "Test" });
    expect(result.seasons).toBe(1);
    expect(result.magnet_urls).toBeUndefined();
  });

  it("rejects missing series_name", () => {
    expect(() => tvSeriesSchema.parse({})).toThrow();
  });

  it("rejects empty series_name", () => {
    expect(() => tvSeriesSchema.parse({ series_name: "" })).toThrow();
  });

  it("rejects episodes_per_season (removed from schema)", () => {
    const result = tvSeriesSchema.parse({
      series_name: "Test",
      episodes_per_season: 5,
    } as any);
    expect(result.series_name).toBe("Test");
    expect((result as any).episodes_per_season).toBeUndefined();
  });
});

describe("searchAndDownloadTvSeries", () => {
  it("auto-searches and auto-downloads when no magnet_urls provided", async () => {
    mockSearchTorrents.mockResolvedValue([
      { magnetUrl: "magnet:?xt=urn:btih:abc", title: "Dark S01", seeders: 50, size: "2 GiB" },
    ]);
    mockAddTorrent.mockResolvedValue('Added "Dark S01" (state: downloading)');

    const result = await searchAndDownloadTvSeries({
      series_name: "Dark",
      seasons: 1,
    });

    expect(result.content[0].text).toContain("Dark S01");
    expect(result.content[0].text).toContain("50 seeders");
    expect(mockCreateClient).toHaveBeenCalled();
    expect(mockCheckConnection).toHaveBeenCalled();
    expect(mockAddTorrent).toHaveBeenCalled();
    expect(mockSearchTorrents).toHaveBeenCalledWith(expect.anything(), "Dark S01", 5, "all");
  });

  it("retries next result when first add fails", async () => {
    mockSearchTorrents.mockResolvedValue([
      { magnetUrl: "magnet:?xt=urn:btih:bad", title: "Dark S01 Bad", seeders: 100, size: "2 GiB" },
      { magnetUrl: "magnet:?xt=urn:btih:good", title: "Dark S01 Good", seeders: 50, size: "2 GiB" },
    ]);
    mockAddTorrent
      .mockRejectedValueOnce(new Error("Invalid magnet"))
      .mockResolvedValueOnce('Added "Dark S01 Good" (state: downloading)');

    const result = await searchAndDownloadTvSeries({
      series_name: "Dark",
      seasons: 1,
    });

    expect(mockAddTorrent).toHaveBeenCalledTimes(2);
    expect(result.content[0].text).toContain("Dark S01 Good");
    expect(result.content[0].text).toContain("50 seeders");
  });

  it("reports all failures when every candidate fails", async () => {
    mockSearchTorrents.mockResolvedValue([
      { magnetUrl: "magnet:?xt=urn:btih:bad1", title: "Bad1", seeders: 100, size: "2 GiB" },
      { magnetUrl: "magnet:?xt=urn:btih:bad2", title: "Bad2", seeders: 50, size: "2 GiB" },
    ]);
    mockAddTorrent
      .mockRejectedValueOnce(new Error("Fail 1"))
      .mockRejectedValueOnce(new Error("Fail 2"));

    const result = await searchAndDownloadTvSeries({
      series_name: "Dark",
      seasons: 1,
    });

    expect(result.content[0].text).toContain("Failed all 2 candidates");
    expect(result.content[0].text).toContain("Bad1");
    expect(result.content[0].text).toContain("Bad2");
  });

  it("reports no results when qBittorrent search finds nothing", async () => {
    mockSearchTorrents.mockResolvedValue([]);

    const result = await searchAndDownloadTvSeries({
      series_name: "Dark",
      seasons: 2,
    });

    expect(result.content[0].text).toContain("No results found");
  });

  it("returns connection error if qBittorrent is unreachable", async () => {
    mockCheckConnection.mockRejectedValueOnce(new Error("Could not connect"));

    const result = await searchAndDownloadTvSeries({
      series_name: "Dark",
      seasons: 1,
    });

    expect(result.content[0].text).toContain("Cannot connect");
  });

  it("adds magnet URLs to qBittorrent when provided", async () => {
    mockAddTorrent.mockResolvedValue('Added "Dark" (state: downloading)');

    const result = await searchAndDownloadTvSeries({
      series_name: "Dark",
      magnet_urls: ["magnet:?xt=urn:btih:abc"],
    });

    expect(result.content[0].text).toContain('Results for "Dark"');
    expect(mockAddTorrent).toHaveBeenCalled();
    expect(mockSetGlobalTrackers).toHaveBeenCalled();
  });

  it("distributes magnets across seasons", async () => {
    await searchAndDownloadTvSeries({
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
    mockAddTorrent.mockResolvedValue('Added "Dark_ The Series" (state: downloading)');

    const result = await searchAndDownloadTvSeries({
      series_name: "Dark: The Series",
      magnet_urls: ["magnet:?xt=urn:btih:abc"],
    });

    expect(result.content[0].text).toContain("sanitized");
    expect(result.content[0].text).toContain("Dark_ The Series");
  });

  it("reports when a magnet add fails", async () => {
    mockAddTorrent.mockRejectedValueOnce(new Error("Invalid magnet"));

    const result = await searchAndDownloadTvSeries({
      series_name: "Dark",
      magnet_urls: ["magnet:?xt=urn:btih:bad"],
    });

    expect(result.content[0].text).toContain("Failed");
  });

  it("sets global trackers on auto-download", async () => {
    mockSearchTorrents.mockResolvedValue([
      { magnetUrl: "magnet:?xt=urn:btih:abc", title: "Dark S01", seeders: 50, size: "2 GiB" },
    ]);
    mockAddTorrent.mockResolvedValue('Added "Dark S01" (state: downloading)');

    await searchAndDownloadTvSeries({
      series_name: "Dark",
      seasons: 1,
    });

    expect(mockSetGlobalTrackers).toHaveBeenCalledTimes(1);
    expect(mockSetGlobalTrackers).toHaveBeenCalledWith({});
  });
});

describe("isNonVideoFile", () => {
  it("filters out .pdf files", () => {
    expect(isNonVideoFile("Some.Book.pdf")).toBe(true);
  });

  it("filters out .epub files", () => {
    expect(isNonVideoFile("document.epub")).toBe(true);
  });

  it("passes through .mkv files", () => {
    expect(isNonVideoFile("Show.S01E01.mkv")).toBe(false);
  });

  it("passes through files with no extension", () => {
    expect(isNonVideoFile("Show S01 Complete 1080p")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isNonVideoFile("Book.PDF")).toBe(true);
    expect(isNonVideoFile("Video.MKV")).toBe(false);
  });

  it("filters out .zip and .rar files", () => {
    expect(isNonVideoFile("archive.zip")).toBe(true);
    expect(isNonVideoFile("archive.rar")).toBe(true);
  });

  it("passes through .mp4 files", () => {
    expect(isNonVideoFile("movie.mp4")).toBe(false);
  });

  it("passes through .avi files", () => {
    expect(isNonVideoFile("movie.avi")).toBe(false);
  });

  it("passes through .mov files", () => {
    expect(isNonVideoFile("movie.mov")).toBe(false);
  });

  it("filters out .mobi files", () => {
    expect(isNonVideoFile("book.mobi")).toBe(true);
  });

  it("filters out .djvu files", () => {
    expect(isNonVideoFile("scan.djvu")).toBe(true);
  });
});

describe("isBlocklistedSite", () => {
  it("filters out libgen site", () => {
    expect(isBlocklistedSite("https://libgen.is")).toBe(true);
  });

  it("filters out sci-hub site", () => {
    expect(isBlocklistedSite("https://sci-hub.se")).toBe(true);
  });

  it("passes through 1337x site", () => {
    expect(isBlocklistedSite("https://1337x.to")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isBlocklistedSite("https://LIBGEN.IS")).toBe(true);
  });

  it("filters out sites containing 'ebook'", () => {
    expect(isBlocklistedSite("https://ebooks-archive.org")).toBe(true);
  });

  it("filters out sites containing 'academic'", () => {
    expect(isBlocklistedSite("https://academic.torrents.com")).toBe(true);
  });

  it("passes through thepiratebay", () => {
    expect(isBlocklistedSite("https://thepiratebay.org")).toBe(false);
  });
});

describe("searchAndDownloadMovie", () => {
  it("auto-searches and auto-downloads when no magnet_urls provided", async () => {
    mockSearchTorrents.mockResolvedValue([
      { magnetUrl: "magnet:?xt=urn:btih:m1", title: "The Matrix 1999", seeders: 100, size: "4 GiB" },
    ]);
    mockAddTorrent.mockResolvedValue('Added "The Matrix 1999" (state: downloading)');

    const result = await searchAndDownloadMovie({
      title: "The Matrix",
    });

    expect(result.content[0].text).toContain("The Matrix 1999");
    expect(result.content[0].text).toContain("100 seeders");
    expect(mockAddTorrent).toHaveBeenCalled();
    expect(mockSearchTorrents).toHaveBeenCalledWith(expect.anything(), "The Matrix", 5, "all");
  });

  it("retries next result when first add fails", async () => {
    mockSearchTorrents.mockResolvedValue([
      { magnetUrl: "magnet:?xt=urn:btih:bad", title: "Bad Result", seeders: 100, size: "4 GiB" },
      { magnetUrl: "magnet:?xt=urn:btih:good", title: "The Matrix 1999", seeders: 80, size: "4 GiB" },
    ]);
    mockAddTorrent
      .mockRejectedValueOnce(new Error("Invalid magnet"))
      .mockResolvedValueOnce('Added "The Matrix 1999" (state: downloading)');

    const result = await searchAndDownloadMovie({
      title: "The Matrix",
    });

    expect(mockAddTorrent).toHaveBeenCalledTimes(2);
    expect(result.content[0].text).toContain("The Matrix 1999");
  });

  it("reports all failures when every candidate fails", async () => {
    mockSearchTorrents.mockResolvedValue([
      { magnetUrl: "magnet:?xt=urn:btih:bad1", title: "Bad1", seeders: 100, size: "4 GiB" },
      { magnetUrl: "magnet:?xt=urn:btih:bad2", title: "Bad2", seeders: 50, size: "4 GiB" },
    ]);
    mockAddTorrent
      .mockRejectedValueOnce(new Error("Fail 1"))
      .mockRejectedValueOnce(new Error("Fail 2"));

    const result = await searchAndDownloadMovie({
      title: "The Matrix",
    });

    expect(result.content[0].text).toContain("Failed to download");
    expect(result.content[0].text).toContain("Bad1");
    expect(result.content[0].text).toContain("Bad2");
  });

  it("reports no results when qBittorrent search finds nothing", async () => {
    mockSearchTorrents.mockResolvedValue([]);

    const result = await searchAndDownloadMovie({
      title: "Unknown Movie",
    });

    expect(result.content[0].text).toContain("No results found");
  });

  it("returns connection error if qBittorrent is unreachable", async () => {
    mockCheckConnection.mockRejectedValueOnce(new Error("Could not connect"));

    const result = await searchAndDownloadMovie({
      title: "The Matrix",
    });

    expect(result.content[0].text).toContain("Cannot connect");
  });

  it("adds magnet URLs to qBittorrent when provided", async () => {
    mockAddTorrent.mockResolvedValue('Added "The Matrix" (state: downloading)');

    const result = await searchAndDownloadMovie({
      title: "The Matrix",
      magnet_urls: ["magnet:?xt=urn:btih:abc"],
    });

    expect(result.content[0].text).toContain('Results for "The Matrix"');
    expect(mockAddTorrent).toHaveBeenCalled();
    expect(mockSetGlobalTrackers).toHaveBeenCalled();
  });

  it("saves to Movies subdirectory", async () => {
    await searchAndDownloadMovie({
      title: "The Matrix",
      magnet_urls: ["magnet:?xt=urn:btih:abc"],
    });

    expect(mockAddTorrent).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.stringContaining("Movies"),
    );
  });

  it("sanitizes movie title with special characters", async () => {
    await searchAndDownloadMovie({
      title: "Spider-Man: No Way Home",
      magnet_urls: ["magnet:?xt=urn:btih:abc"],
    });

    expect(mockAddTorrent).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.stringContaining("Spider-Man_ No Way Home"),
    );
  });

  it("reports when a magnet add fails in manual mode", async () => {
    mockAddTorrent.mockRejectedValueOnce(new Error("Invalid magnet"));

    const result = await searchAndDownloadMovie({
      title: "The Matrix",
      magnet_urls: ["magnet:?xt=urn:btih:bad"],
    });

    expect(result.content[0].text).toContain("Failed");
  });

  it("sets global trackers on auto-download", async () => {
    mockSearchTorrents.mockResolvedValue([
      { magnetUrl: "magnet:?xt=urn:btih:m1", title: "The Matrix", seeders: 100, size: "4 GiB" },
    ]);
    mockAddTorrent.mockResolvedValue('Added "The Matrix" (state: downloading)');

    await searchAndDownloadMovie({ title: "The Matrix" });

    expect(mockSetGlobalTrackers).toHaveBeenCalledTimes(1);
    expect(mockSetGlobalTrackers).toHaveBeenCalledWith({});
  });

  it("searches with maxResults=5", async () => {
    mockSearchTorrents.mockResolvedValue([]);

    await searchAndDownloadMovie({ title: "Test" });

    expect(mockSearchTorrents).toHaveBeenCalledWith(expect.anything(), "Test", 5, "all");
  });
});
