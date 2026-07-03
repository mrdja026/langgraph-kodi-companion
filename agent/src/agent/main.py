import argparse
import asyncio
import logging
import sys

from langgraph.checkpoint.sqlite import SqliteSaver
from langchain_mcp_adapters.client import MultiServerMCPClient

from agent.config import settings
from agent.graph import make_graph
from agent.tools import bind_mcp_tools, verify_mcp_tools, get_duckduckgo_tool

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def startup_health_check() -> None:
    if settings.langsmith_tracing and not settings.langsmith_api_key:
        logger.warning("LANGSMITH_TRACING enabled but LANGSMITH_API_KEY is unset — running untraced")


async def main() -> None:
    parser = argparse.ArgumentParser(description="LangGraph MCP Agent CLI")
    parser.add_argument("--thread", required=True, help="Conversation thread ID")
    args = parser.parse_args()

    await startup_health_check()

    checkpointer = SqliteSaver.from_conn_string(settings.checkpoint_db)

    async with MultiServerMCPClient() as client:
        await bind_mcp_tools(client)
        await verify_mcp_tools(client)

        duckduckgo = get_duckduckgo_tool()

        dynamic_tools = client.get_tools()
        dynamic_tools.append(duckduckgo)

        agent = make_graph(tools=dynamic_tools, checkpointer=checkpointer)

        config = {
            "configurable": {"thread_id": args.thread},
            "metadata": {"thread_id": args.thread},
        }

        print(f"Agent ready. Thread: {args.thread}. Tools: {[t.name for t in dynamic_tools]}")
        print("Type your message (Ctrl+C to exit):")

        while True:
            try:
                user_input = input("> ").strip()
                if not user_input:
                    continue
            except (EOFError, KeyboardInterrupt):
                print("\nGoodbye.")
                break

            try:
                async for chunk in agent.astream(
                    {"messages": [{"role": "user", "content": user_input}]},
                    config,
                ):
                    for node_name, output in chunk.items():
                        if node_name == "agent":
                            last_msg = output["messages"][-1]
                            if hasattr(last_msg, "content") and last_msg.content:
                                print(f"\n{last_msg.content}\n")
            except Exception as e:
                print(f"\nError: {e}\n")


if __name__ == "__main__":
    asyncio.run(main())
