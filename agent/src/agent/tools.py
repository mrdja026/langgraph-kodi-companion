from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_community.tools import DuckDuckGoSearchRun

from agent.config import settings


REQUIRED_MCP_TOOLS = {"read_watchlist", "download_and_format_series"}


async def bind_mcp_tools(client: MultiServerMCPClient) -> None:
    client.add_streamable_http_server(
        server_name="media-server",
        url=settings.mcp_server_url,
        timeout=settings.mcp_timeout_s,
    )


async def verify_mcp_tools(client: MultiServerMCPClient) -> None:
    tools = client.get_tools()
    tool_names = {t.name for t in tools}
    missing = REQUIRED_MCP_TOOLS - tool_names
    if missing:
        raise RuntimeError(
            f"MCP server missing required tools: {', '.join(sorted(missing))}. "
            f"Found: {', '.join(sorted(tool_names))}"
        )


def get_duckduckgo_tool() -> DuckDuckGoSearchRun:
    return DuckDuckGoSearchRun()
