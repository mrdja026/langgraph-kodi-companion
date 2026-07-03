from langchain_openai import ChatOpenAI

from agent.config import settings


llm = ChatOpenAI(
    base_url=settings.llm_base_url,
    api_key=settings.llm_api_key or "local",
    model=settings.llm_model or "",
    timeout=settings.llm_timeout_s,
    temperature=0,
)
