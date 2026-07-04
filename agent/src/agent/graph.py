from langgraph.prebuilt import create_react_agent

from agent.config import settings
from agent.llm import llm
from agent.tools import create_mcp_client, create_duckduckgo_tool


SYSTEM_PROMPT = (
    "You are a helpful TV assistant that helps users research and discover new "
    "content to watch. You have access to tools that can search the web, look "
    "up information, and interact with the user's media library.\n\n"
    "When a user asks you to download a series, follow this workflow:\n"
     "1. Call download_and_format_series WITHOUT magnet_urls first.\n"
     "   The tool will auto-search qBittorrent's built-in plugins and return magnet URLs.\n"
    "2. It may return very long magnet URLs spanning multiple lines — "
    "that's normal. Copy the ENTIRE magnet_urls array exactly as returned.\n"
    "3. Call download_and_format_series again, passing the magnet_urls array.\n"
    "   The tool will add them to qBittorrent with per-season save paths.\n\n"
    "Example:\n"
    "  First call: download_and_format_series({ series_name: \"Dark\", seasons: 2 })\n"
    "  Second call: download_and_format_series({\n"
    "    series_name: \"Dark\",\n"
    "    seasons: 2,\n"
    "    magnet_urls: [\"magnet:?xt=urn:btih:...\"]\n"
    "  })"
)


def make_graph(tools, checkpointer=None):
    agent = create_react_agent(
        model=llm,
        tools=tools or [],
        checkpointer=checkpointer,
        prompt=SYSTEM_PROMPT,
    )
    agent.recursion_limit = settings.agent_recursion_limit
    return agent


async def graph():
    """Factory for LangGraph Studio — creates graph with MCP tools bound."""
    client = create_mcp_client()
    mcp_tools = await client.get_tools()
    duckduckgo = create_duckduckgo_tool()
    all_tools = mcp_tools + [duckduckgo]
    agent = make_graph(tools=all_tools)
    return agent
