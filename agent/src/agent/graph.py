from langgraph.prebuilt import create_react_agent

from agent.config import settings
from agent.llm import llm
from agent.tools import create_mcp_client, create_duckduckgo_tool


def make_graph(tools, checkpointer=None):
    agent = create_react_agent(
        model=llm,
        tools=tools or [],
        checkpointer=checkpointer,
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
