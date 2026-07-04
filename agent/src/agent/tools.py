from typing import Awaitable, Callable

from langchain_core.messages import ToolMessage
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.interceptors import ToolCallInterceptor
from langchain_mcp_adapters.tools import MCPToolCallRequest, MCPToolCallResult
from langchain_community.tools import DuckDuckGoSearchRun

from agent.config import settings

REQUIRED_MCP_TOOLS = {"read_watchlist", "search_and_download_tv_series", "search_and_download_movie"}

READ_ONLY_TOOLS = {"read_watchlist"}
MUTATING_TOOLS = {"search_and_download_tv_series", "search_and_download_movie"}


def create_mcp_client() -> MultiServerMCPClient:
    return MultiServerMCPClient(
        connections={
            "media-server": {
                "url": settings.mcp_server_url,
                "transport": "http",
                "timeout": settings.mcp_timeout_s,
            }
        },
        handle_tool_errors=True,
        tool_interceptors=[RetryPolicyInterceptor()],
    )


def _tool_error(request: MCPToolCallRequest, msg: str) -> MCPToolCallResult:
    return ToolMessage(
        content=msg,
        status="error",
        name=request.name,
        tool_call_id=request.tool_call_id,
    )


class RetryPolicyInterceptor(ToolCallInterceptor):
    async def __call__(
        self,
        request: MCPToolCallRequest,
        handler: Callable[[MCPToolCallRequest], Awaitable[MCPToolCallResult]],
    ) -> MCPToolCallResult:
        tool_name = request.name

        try:
            return await handler(request)
        except Exception as e:
            if tool_name in READ_ONLY_TOOLS:
                try:
                    return await handler(request)
                except Exception as retry_e:
                    return _tool_error(
                        request,
                        f"Tool '{tool_name}' unavailable after retry: {retry_e}",
                    )
            else:
                return _tool_error(
                    request,
                    f"Tool '{tool_name}' unavailable (not retried — mutating operation): {e}",
                )


async def verify_mcp_tools(tools: list) -> None:
    tool_names = {t.name for t in tools}
    missing = REQUIRED_MCP_TOOLS - tool_names
    if missing:
        raise RuntimeError(
            f"MCP server missing required tools: {', '.join(sorted(missing))}. "
            f"Found: {', '.join(sorted(tool_names))}"
        )


def create_duckduckgo_tool() -> DuckDuckGoSearchRun:
    return DuckDuckGoSearchRun(
        handle_tool_error=True,
        name="duckduckgo_search",
        description=(
            "Searches the web using DuckDuckGo. "
            "Use this for current information, release dates, new seasons, "
            "or any question requiring up-to-date external data. "
            "Returns search result snippets with source links."
        ),
    )
