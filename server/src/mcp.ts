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
    description: "Reads watchlist files from a directory on the host filesystem, confined to WATCHLIST_ROOT",
    inputSchema: z.object({
      directory_path: z.string().describe("Path relative to WATCHLIST_ROOT"),
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
      "Creates placeholder media files for a TV series in the standardized Show Name/Season NN/S##E##.mp4 layout under MEDIA_ROOT. STUB — no real download occurs.",
    inputSchema: z.object({
      series_name: z.string().describe("Name of the series"),
      seasons: z.number().int().min(1).optional().default(1).describe("Number of seasons"),
      episodes_per_season: z.number().int().min(1).optional().default(3).describe("Episodes per season"),
    }),
  },
  async (args) => {
    const result = await downloadAndFormatSeries(args);
    return result;
  },
);

export { server, McpServer };
