from langchain_openai import ChatOpenAI
from openai import APIConnectionError, AuthenticationError, NotFoundError
from openai import AsyncOpenAI

from agent.config import settings

llm = ChatOpenAI(
    base_url=settings.llm_base_url,
    api_key=settings.llm_api_key or "local",
    model=settings.llm_model or "",
    timeout=settings.llm_timeout_s,
    temperature=0,
    streaming=True,
)


async def check_llm_reachable() -> str:
    try:
        client = AsyncOpenAI(
            base_url=settings.llm_base_url,
            api_key=settings.llm_api_key or "local",
        )
        models = await client.models.list()
        model_ids = [m.id for m in models.data]

        if settings.llm_model and settings.llm_model not in model_ids:
            return (
                f"Warning: configured model '{settings.llm_model}' not found in "
                f"endpoint model list: {', '.join(model_ids)}. "
                f"The agent may still work if the model supports tool calling."
            )

        if settings.llm_model:
            return f"LLM endpoint reachable at {settings.llm_base_url}, model '{settings.llm_model}' available"
        else:
            return (
                f"LLM endpoint reachable at {settings.llm_base_url}. "
                f"Available models: {', '.join(model_ids[:5])}{'...' if len(model_ids) > 5 else ''}. "
                f"Set LLM_MODEL to select one."
            )

    except APIConnectionError:
        raise ConnectionError(
            f"Cannot connect to LLM endpoint at {settings.llm_base_url}. "
            f"Ensure your local model server is running (e.g., vLLM with --enable-auto-tool-choice)."
        )
    except AuthenticationError:
        raise ConnectionError(
            f"LLM endpoint at {settings.llm_base_url} rejected the API key. "
            f"Check LLM_API_KEY."
        )
    except NotFoundError:
        raise ConnectionError(
            f"LLM endpoint at {settings.llm_base_url} returned 404. "
            f"Ensure the path includes /v1 (e.g., http://localhost:8000/v1)."
        )
    except Exception as e:
        raise ConnectionError(
            f"LLM endpoint health check failed for {settings.llm_base_url}: {e}"
        )
