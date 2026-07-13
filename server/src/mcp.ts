import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { readWatchlist } from "./tools/watchlist.js";
import { scanMediaLibrary } from "./tools/media_library.js";
import { searchAndDownloadTvSeries } from "./tools/series.js";
import { searchAndDownloadMovie } from "./tools/movie.js";
import { addToWatchlist } from "./tools/watchlist_add.js";
import { scanCompletedDownloads } from "./tools/completed_downloads.js";

const server = new McpServer({
  name: "media-mcp-server",
  version: "1.0.0",
});

server.registerTool(
  "read_watchlist",
  {
    title: "Read Watchlist",
    description: "Reads watchlist files. Pass an empty string or omit directory_path to read the root watchlist directory.",
    inputSchema: z.object({
      directory_path: z.string().default("").describe("Subdirectory name (relative to watchlist root). Pass empty string for root."),
    }),
  },
  async (args) => {
    const result = await readWatchlist(args);
    return result;
  },
);

server.registerTool(
  "scan_media_library",
  {
    title: "Scan Media Library",
    description:
      "Scans the user's downloaded media library (both Movies and TV Series directories). " +
      "Returns a structured list of all movies and TV series that are already downloaded and available, " +
      "including season/episode counts for TV shows. Use this to see what the user already owns before " +
      "making recommendations or deciding what to download.",
    inputSchema: z.object({}),
  },
  async (args) => {
    const result = await scanMediaLibrary();
    return result;
  },
);

server.registerTool(
  "search_and_download_tv_series",
  {
    title: "Search and Download TV Series",
    description:
      "Search for and download TV series episodes/seasons via qBittorrent. " +
      "Auto-searches TV category (non-video results like PDFs/ebooks are filtered out). " +
      "Saves to MEDIA_ROOT/<Series>/Season NN/. " +
      "Call without magnet_urls to search, then call again with magnet_urls to download.",
    inputSchema: z.object({
      series_name: z.string().describe("Name of the TV series"),
      seasons: z.number().int().min(1).optional().default(1).describe("Number of seasons"),
      magnet_urls: z.array(z.string()).optional().describe("Optional magnet links. If omitted, the tool returns search hints."),
    }),
  },
  async (args) => {
    const result = await searchAndDownloadTvSeries(args);
    return result;
  },
);

server.registerTool(
  "search_and_download_movie",
  {
    title: "Search and Download Movie",
    description:
      "Search for and download movies via qBittorrent. " +
      "Auto-searches movies category (non-video results like PDFs/ebooks are filtered out). " +
      "Saves to MEDIA_ROOT/Movies/<Title>/. " +
      "Call without magnet_urls to search, then call again with magnet_urls to download.",
    inputSchema: z.object({
      title: z.string().describe("Movie title"),
      magnet_urls: z.array(z.string()).optional().describe("Optional magnet links. If omitted, the tool returns search hints."),
    }),
  },
  async (args) => {
    const result = await searchAndDownloadMovie(args);
    return result;
  },
);

server.registerTool(
  "add_to_watchlist",
  {
    title: "Add to Watchlist",
    description:
      "Add a movie or TV show to the user's watchlist by writing a markdown file with YAML frontmatter. " +
      "Creates watchlist_root/movie/<Title>.md or watchlist_root/tv/<Title>.md. " +
      "Use after a successful download so the user's watchlist stays up to date.",
    inputSchema: z.object({
      title: z.string().min(1).describe("Movie or TV show title"),
      year: z.number().int().optional().describe("Release year"),
      type: z.enum(["movie", "tv"]).describe("Whether this is a movie or TV show"),
      imdb_url: z.string().optional().describe("IMDB or TMDb URL"),
      genre: z.string().optional().describe("Comma-separated genres"),
      status: z.string().optional().default("downloaded").describe("Watchlist status (downloaded, watchlist, etc.)"),
      overwrite: z.boolean().optional().default(false).describe("Overwrite existing entry if it exists"),
    }),
  },
  async (args) => {
    const result = await addToWatchlist(args);
    return result;
  },
);

server.registerTool(
  "scan_completed_downloads",
  {
    title: "Scan Completed Downloads",
    description:
      "Queries qBittorrent for all torrents that have finished downloading (100% progress). " +
      "Returns a list of completed torrents with name, size, completion date, and inferred type (movie/TV). " +
      "Use this to discover recently finished downloads and optionally add them to the watchlist.",
    inputSchema: z.object({}),
  },
  async () => {
    const result = await scanCompletedDownloads();
    return result;
  },
);

export { server, McpServer };
