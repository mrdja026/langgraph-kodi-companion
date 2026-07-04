import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { readWatchlist } from "./tools/watchlist.js";
import { searchAndDownloadTvSeries } from "./tools/series.js";
import { searchAndDownloadMovie } from "./tools/movie.js";

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

export { server, McpServer };
