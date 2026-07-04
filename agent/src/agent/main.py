import argparse
import asyncio
import logging
import sys

from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from agent.config import settings
from agent.graph import make_graph
from agent.llm import check_llm_reachable
from agent.tools import (
    create_mcp_client,
    verify_mcp_tools,
    create_duckduckgo_tool,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class Spinner:
    def __init__(self):
        self._running = False
        self._task = None
        self._frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

    async def _spin(self):
        i = 0
        while self._running:
            sys.stdout.write(f"\r{self._frames[i]} ")
            sys.stdout.flush()
            i = (i + 1) % len(self._frames)
            await asyncio.sleep(0.1)
        sys.stdout.write("\r" + " " * 60 + "\r")
        sys.stdout.flush()

    async def start(self):
        self._running = True
        self._task = asyncio.create_task(self._spin())

    async def stop(self):
        self._running = False
        if self._task:
            await self._task
            self._task = None


async def check_langsmith() -> None:
    if not settings.langsmith_tracing:
        return
    if not settings.langsmith_api_key:
        logger.warning("LANGSMITH_TRACING enabled but LANGSMITH_API_KEY is unset — running untraced")
        return
    try:
        import httpx
        from uuid import uuid4
        async with httpx.AsyncClient() as hc:
            resp = await hc.post(
                f"{settings.langsmith_endpoint}/runs",
                headers={"x-api-key": settings.langsmith_api_key},
                json={
                    "name": "langgraph-mcp-agent-connectivity-check",
                    "run_type": "llm",
                    "inputs": {},
                    "session_name": settings.langsmith_project,
                    "id": str(uuid4()),
                },
                timeout=10,
            )
            if resp.status_code == 403:
                logger.warning(
                    "LangSmith API returned 403 Forbidden on run write — the API key "
                    "lacks write permission. Traces will not be visible. "
                    "Generate a new key at https://smith.langchain.com/settings"
                    " with write access (or create the project first)."
                )
            elif resp.status_code != 200 and resp.status_code != 201:
                logger.warning(f"LangSmith API returned {resp.status_code} — tracing may not work")
    except Exception as exc:
        logger.warning(f"LangSmith connectivity check failed: {exc}")


async def ainput(prompt: str) -> str:
    return await asyncio.to_thread(input, prompt)


async def main() -> None:
    parser = argparse.ArgumentParser(description="LangGraph MCP Agent CLI")
    parser.add_argument("--thread", default="default", help="Conversation thread ID (default: default)")
    parser.add_argument("--skip-health-check", action="store_true", help="Skip LLM endpoint health check")
    args = parser.parse_args()

    await check_langsmith()

    if not args.skip_health_check:
        try:
            msg = await check_llm_reachable()
            print(f"[{msg}]")
        except ConnectionError as e:
            print(f"ERROR: {e}")
            print("Use --skip-health-check to bypass this check and try anyway.")
            sys.exit(1)

    client = create_mcp_client()
    mcp_tools = await client.get_tools()
    await verify_mcp_tools(mcp_tools)

    duckduckgo = create_duckduckgo_tool()
    all_tools = mcp_tools + [duckduckgo]

    config = {
        "configurable": {"thread_id": args.thread},
        "metadata": {"thread_id": args.thread},
    }

    print(f"Tools: {[t.name for t in all_tools]}")

    async with AsyncSqliteSaver.from_conn_string(settings.checkpoint_db) as checkpointer:
        agent = make_graph(tools=all_tools, checkpointer=checkpointer)

        print(f"Agent ready. Thread: {args.thread}.")
        print("Type your message (Ctrl+C to exit):")

        while True:
            try:
                user_input = await ainput("\n> ")
                user_input = user_input.strip()
                if not user_input:
                    continue
            except (EOFError, KeyboardInterrupt):
                print("\nGoodbye.")
                break

            final_answer = ""
            spinner = Spinner()
            await spinner.start()
            try:
                async for chunk in agent.astream(
                    {"messages": [{"role": "user", "content": user_input}]},
                    config,
                ):
                    await spinner.stop()
                    for node_name, output in chunk.items():
                        if node_name == "agent":
                            last_msg = output["messages"][-1]
                            if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
                                tool_names = [tc["name"] for tc in last_msg.tool_calls]
                                print(f"\n  ▶ {', '.join(tool_names)}")
                            if hasattr(last_msg, "content") and last_msg.content:
                                final_answer = last_msg.content
                        elif node_name == "tools":
                            for msg in output.get("messages", []):
                                if hasattr(msg, "name") and msg.name:
                                    print(f"  ✓ {msg.name}")
                    await spinner.start()
            except asyncio.CancelledError:
                print("\nInterrupted.")
                continue
            except Exception as e:
                print(f"\n[Error: {e}]")
                continue
            finally:
                await spinner.stop()

            if final_answer:
                print(f"\n{final_answer}")


if __name__ == "__main__":
    asyncio.run(main())
