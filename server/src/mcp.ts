import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { readWatchlist } from "./tools/watchlist.js";
import { downloadAndFormatSeries } from "./tools/series.js";

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
  "download_and_format_series",
  {
    title: "Download and Format Series",
    description:
      "Adds magnet URLs to qBittorrent for download, organized under MEDIA_ROOT/<Series>/Season NN/. " +
      "If magnet_urls is not provided, the tool auto-searches qBittorrent's built-in search plugins and returns the found magnet URLs. " +
      "Pass the returned magnet_urls array back in a second call to trigger the actual download.",
    inputSchema: z.object({
      series_name: z.string().describe("Name of the series"),
      seasons: z.number().int().min(1).optional().default(1).describe("Number of seasons"),
      episodes_per_season: z.number().int().min(1).optional().default(3).describe("Episodes per season"),
      magnet_urls: z.array(z.string()).optional().describe("Optional magnet links. If omitted, the tool returns search hints."),
    }),
  },
  async (args) => {
    const result = await downloadAndFormatSeries(args);
    return result;
  },
);

export { server, McpServer };
