from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    llm_base_url: str = "http://localhost:8000/v1"
    llm_api_key: str = "local"
    llm_model: str = ""
    llm_timeout_s: int = 120

    mcp_server_url: str = "http://localhost:3001/mcp"
    mcp_timeout_s: int = 30

    watchlist_root: str = ""
    media_root: str = ""

    checkpoint_db: str = "checkpoints.sqlite"
    agent_recursion_limit: int = 25

    langsmith_tracing: bool = False
    langsmith_api_key: str = ""
    langsmith_project: str = "langgraph-mcp-agent"


settings = Settings()
