from langgraph.prebuilt import create_react_agent
from langchain_core.messages import SystemMessage

from agent.config import settings
from agent.llm import llm

SYSTEM_PROMPT = (
    "You are a helpful media watchlist assistant. "
    "You have access to the following tools:\n"
    "- read_watchlist: reads watchlist files from a directory on the host filesystem\n"
    "- download_and_format_series: creates placeholder media files for a TV series\n"
    "- duckduckgo_search: searches the web for current information\n\n"
    "Use read_watchlist when the user asks about their watchlist content. "
    "Use download_and_format_series when the user asks to download or fetch a series. "
    "Use duckduckgo_search when you need current or external information. "
    "If you can answer from conversation context alone, respond directly without tools."
)


def make_graph(tools, checkpointer=None):
    agent = create_react_agent(
        model=llm,
        tools=tools or [],
        prompt=SystemMessage(content=SYSTEM_PROMPT),
        checkpointer=checkpointer,
    )
    agent.recursion_limit = settings.agent_recursion_limit
    return agent


graph = make_graph(tools=[])
