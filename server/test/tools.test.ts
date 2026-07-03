import { describe, it, expect, beforeAll } from "vitest";
import * as path from "node:path";
import * as os from "node:os";

const tmpDir = path.join(os.tmpdir(), "mcp-test-" + Date.now());
const watchlistDir = path.join(tmpDir, "watchlist");
const mediaDir = path.join(tmpDir, "media");

let readWatchlist: typeof import("../src/tools/watchlist.js")["readWatchlist"];
let watchlistSchema: typeof import("../src/tools/watchlist.js")["watchlistSchema"];
let downloadAndFormatSeries: typeof import("../src/tools/series.js")["downloadAndFormatSeries"];
let seriesSchema: typeof import("../src/tools/series.js")["seriesSchema"];

beforeAll(async () => {
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

  it("rejects empty directory_path", () => {
    expect(() => watchlistSchema.parse({ directory_path: "" })).toThrow();
  });
});

describe("readWatchlist", () => {
  it("rejects path traversal", async () => {
    await expect(
      readWatchlist({ directory_path: "..\\..\\windows" }),
    ).rejects.toThrow("Path traversal denied");
  });

  it("returns missing directory message", async () => {
    const result = await readWatchlist({ directory_path: "nonexistent-dir" });
    expect(result.content[0].text).toContain("Directory not found");
  });
});

describe("seriesSchema", () => {
  it("accepts valid series input", () => {
    const result = seriesSchema.parse({
      series_name: "Dark",
      seasons: 1,
      episodes_per_season: 2,
    });
    expect(result.series_name).toBe("Dark");
    expect(result.seasons).toBe(1);
    expect(result.episodes_per_season).toBe(2);
  });

  it("applies defaults for optional fields", () => {
    const result = seriesSchema.parse({ series_name: "Test" });
    expect(result.seasons).toBe(1);
    expect(result.episodes_per_season).toBe(3);
  });

  it("rejects missing series_name", () => {
    expect(() => seriesSchema.parse({})).toThrow();
  });
});

describe("downloadAndFormatSeries", () => {
  it("creates placeholder files in the expected layout", async () => {
    const result = await downloadAndFormatSeries({
      series_name: "Dark",
      seasons: 1,
      episodes_per_season: 2,
    });

    expect(result.content[0].text).toContain("Created placeholder files");
    expect(result.content[0].text).toContain("Season 01");
    expect(result.content[0].text).toContain("S01E01.mp4");
    expect(result.content[0].text).toContain("S01E02.mp4");
  });

  it("sanitizes problematic characters in series name", async () => {
    const result = await downloadAndFormatSeries({
      series_name: "Dark: The Series",
    });

    expect(result.content[0].text).toContain("sanitized");
    expect(result.content[0].text).toContain("Dark_ The Series");
    expect(result.content[0].text).toContain("placeholder");
  });
});
