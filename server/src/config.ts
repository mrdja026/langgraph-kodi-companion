function env(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function envNum(key: string, fallback: number): number {
  const v = process.env[key];
  return v ? Number(v) : fallback;
}

function envBool(key: string): boolean {
  return process.env[key] === "true";
}

export function getConfig() {
  return {
    llmBaseUrl: env("LLM_BASE_URL", "http://localhost:8000/v1"),
    llmApiKey: env("LLM_API_KEY", "local"),
    llmModel: env("LLM_MODEL", ""),
    llmTimeoutS: envNum("LLM_TIMEOUT_S", 120),

    mcpServerUrl: env("MCP_SERVER_URL", "http://localhost:3001/mcp"),
    mcpTimeoutS: envNum("MCP_TIMEOUT_S", 30),

    watchlistRoot: env("WATCHLIST_ROOT", ""),
    mediaRoot: env("MEDIA_ROOT", ""),

    checkpointDb: env("CHECKPOINT_DB", "checkpoints.sqlite"),
    agentRecursionLimit: envNum("AGENT_RECURSION_LIMIT", 25),

    langsmithTracing: envBool("LANGSMITH_TRACING"),
    langsmithApiKey: env("LANGSMITH_API_KEY", ""),
    langsmithProject: env("LANGSMITH_PROJECT", "langgraph-mcp-agent"),

    qbtHost: env("QBT_HOST", "localhost"),
    qbtPort: envNum("QBT_PORT", 8080),
    qbtUsername: env("QBT_USERNAME", "admin"),
    qbtPassword: env("QBT_PASSWORD", "adminadmin"),

    mcpBindHost: env("MCP_BIND_HOST", "127.0.0.1"),
    mcpBindPort: envNum("MCP_BIND_PORT", 3001),
  };
}

export type Config = ReturnType<typeof getConfig>;
