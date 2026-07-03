import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { StreamableHTTPTransport } from "@hono/mcp";
import { server } from "./mcp.js";
import { getConfig } from "./config.js";
const config = getConfig();

const app = new Hono();

const transport = new StreamableHTTPTransport();

app.use("/mcp", async (c, next) => {
  if (!server.isConnected()) {
    await server.connect(transport);
  }
  await next();
});

app.all("/mcp", async (c) => {
  return transport.handleRequest(c);
});

app.get("/health", (c) => c.json({ status: "ok" }));

console.log(`MCP server starting on ${config.mcpBindHost}:${config.mcpBindPort}`);
console.log(`MCP endpoint: http://${config.mcpBindHost}:${config.mcpBindPort}/mcp`);
console.log(`Health: http://${config.mcpBindHost}:${config.mcpBindPort}/health`);

serve({
  fetch: app.fetch,
  hostname: config.mcpBindHost,
  port: config.mcpBindPort,
});
