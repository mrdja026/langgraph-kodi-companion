import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

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
    langsmith_endpoint: str = "https://api.smith.langchain.com"


settings = Settings()

# Ensure LangSmith env vars are set in os.environ (pydantic-settings reads them
# from .env but does not export them; LangSmith SDK checks os.environ directly).
# Use direct assignment (not setdefault) to guarantee values override any stale
# environment defaults.
if settings.langsmith_api_key:
    os.environ["LANGSMITH_API_KEY"] = settings.langsmith_api_key
    os.environ["LANGCHAIN_API_KEY"] = settings.langsmith_api_key
if settings.langsmith_project:
    os.environ["LANGSMITH_PROJECT"] = settings.langsmith_project
    os.environ["LANGCHAIN_PROJECT"] = settings.langsmith_project
if settings.langsmith_tracing:
    os.environ["LANGSMITH_TRACING"] = "true"
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
if settings.langsmith_endpoint:
    os.environ["LANGSMITH_ENDPOINT"] = settings.langsmith_endpoint
    os.environ["LANGCHAIN_ENDPOINT"] = settings.langsmith_endpoint
