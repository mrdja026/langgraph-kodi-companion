from typing import Awaitable, Callable

from langchain_core.messages import ToolMessage
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.interceptors import ToolCallInterceptor
from langchain_mcp_adapters.tools import MCPToolCallRequest, MCPToolCallResult
import requests

from langchain_core.tools import StructuredTool

from agent.config import settings

REQUIRED_MCP_TOOLS = {"read_watchlist", "scan_media_library", "search_and_download_tv_series", "search_and_download_movie", "add_to_watchlist", "scan_completed_downloads"}

READ_ONLY_TOOLS = {"read_watchlist", "scan_media_library", "scan_completed_downloads"}
MUTATING_TOOLS = {"search_and_download_tv_series", "search_and_download_movie", "add_to_watchlist"}


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


def create_web_search_tool() -> StructuredTool:
    def search(query: str) -> str:
        try:
            resp = requests.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": settings.tavily_api_key,
                    "query": query,
                    "search_depth": "basic",
                    "max_results": 5,
                    "include_answer": False,
                    "include_raw_content": False,
                },
                timeout=15,
            )
            if resp.status_code == 401:
                return (
                    "Web search unavailable: Tavily API returned 401 Unauthorized. "
                    "Your API key may be invalid or the free tier quota may be exhausted. "
                    "Check https://app.tavily.com to verify your key and quota."
                )
            if resp.status_code != 200:
                return f"Web search error: Tavily returned HTTP {resp.status_code}."
            data = resp.json()
        except requests.RequestException as e:
            if "401" in str(e):
                return (
                    "Web search unavailable: Tavily API returned 401 Unauthorized. "
                    "Your API key may be invalid or the free tier quota may be exhausted. "
                    "Check https://app.tavily.com to verify your key and quota."
                )
            return f"Web search error: {e}"

        results = data.get("results", [])
        if not results:
            return "No search results found."
        parts = []
        for r in results[:5]:
            parts.append(f"Title: {r['title']}\nURL: {r['url']}\nSnippet: {r['content']}")
        return "\n\n".join(parts)

    return StructuredTool.from_function(
        name="web_search",
        func=search,
        description=(
            "Searches the web using Tavily. "
            "Use this for current information, release dates, new seasons, "
            "or any question requiring up-to-date external data. "
            "Returns formatted search results with titles, URLs, and snippets."
        ),
    )
