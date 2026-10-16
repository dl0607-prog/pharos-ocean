"""OpenAI 兼容 LLM 客户端：DeepSeek / 智谱 / 通义 / Kimi / OpenAI / 硅基流动等通用。"""
import json
import re
from typing import Any, AsyncGenerator, Dict, List, Optional

import httpx

from . import config


class LLMNotConfigured(Exception):
    pass


class LLMError(Exception):
    pass


def configured() -> bool:
    return config.llm_configured()


def _check() -> None:
    if not configured():
        raise LLMNotConfigured(
            "尚未配置 AI 服务。请点击右上角 ⚙ 按钮，粘贴你的 API Key（DeepSeek / 智谱 / 通义等均可）"
        )


def _headers() -> Dict[str, str]:
    return {"Authorization": "Bearer " + config.LLM_API_KEY}


async def test_connection() -> str:
    """用当前配置发一条最小请求，验证连通性与 Key 有效性。"""
    return await chat(
        [{"role": "user", "content": "只回复两个字：正常"}],
        temperature=0, max_tokens=16, retries=0,
    )


async def chat(
    messages: List[Dict[str, str]],
    temperature: Optional[float] = None,
    max_tokens: int = 4000,
    retries: int = 2,
) -> str:
    """调用 chat/completions（非流式），自动重试限流与瞬时错误。"""
    _check()
    # 公网部署防护：每次请求前校验目标地址，拒绝环回/私网/保留地址
    config.validate_llm_base_url(config.LLM_BASE_URL)
    payload = {
        "model": config.LLM_MODEL,
        "messages": messages,
        "temperature": config.LLM_TEMPERATURE if temperature is None else temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }
    url = config.LLM_BASE_URL + "/chat/completions"
    last_err: Optional[str] = None
    for attempt in range(retries + 1):
        try:
            async with httpx.AsyncClient(timeout=config.LLM_TIMEOUT) as client:
                resp = await client.post(url, json=payload, headers=_headers())
                if resp.status_code == 429 or resp.status_code >= 500:
                    last_err = f"HTTP {resp.status_code}: {resp.text[:300]}"
                    import asyncio
                    await asyncio.sleep(2 * (attempt + 1))
                    continue
                resp.raise_for_status()
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                return content or ""
        except httpx.HTTPStatusError as e:
            raise LLMError(f"AI 接口返回错误 HTTP {e.response.status_code}: {e.response.text[:300]}")
        except (httpx.RequestError, KeyError, IndexError) as e:
            last_err = str(e)
            import asyncio
            await asyncio.sleep(2 * (attempt + 1))
    raise LLMError(f"AI 调用失败（已重试 {retries} 次）：{last_err}")


async def stream_chat(messages: List[Dict[str, str]]) -> AsyncGenerator[str, None]:
    """调用 chat/completions（流式），逐段产出回复文本。"""
    _check()
    # 公网部署防护：每次请求前校验目标地址，拒绝环回/私网/保留地址
    config.validate_llm_base_url(config.LLM_BASE_URL)
    payload = {
        "model": config.LLM_MODEL,
        "messages": messages,
        "temperature": config.LLM_TEMPERATURE,
        "max_tokens": 4000,
        "stream": True,
    }
    url = config.LLM_BASE_URL + "/chat/completions"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(connect=20, read=config.LLM_TIMEOUT, write=20, pool=20)) as client:
            async with client.stream("POST", url, json=payload, headers=_headers()) as resp:
                if resp.status_code != 200:
                    body = (await resp.aread()).decode("utf-8", "replace")
                    raise LLMError(f"AI 接口返回错误 HTTP {resp.status_code}: {body[:300]}")
                async for line in resp.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[len("data:"):].strip()
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    try:
                        delta = chunk["choices"][0].get("delta") or {}
                        text = delta.get("content")
                    except (KeyError, IndexError):
                        continue
                    if text:
                        yield text
    except httpx.RequestError as e:
        raise LLMError(f"无法连接 AI 服务：{e}")


_JSON_FENCE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.S)


async def chat_json(messages: List[Dict[str, str]], max_tokens: int = 4000) -> Any:
    """要求模型输出 JSON 并稳健解析：兼容 ```json 围栏与前后杂文。"""
    text = await chat(messages, temperature=0.3, max_tokens=max_tokens)
    return parse_json(text)


def parse_json(text: str) -> Any:
    fence = _JSON_FENCE.search(text)
    candidate = fence.group(1) if fence else text
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        pass
    # 退化策略：截取第一个 { 或 [ 到最后一个 } 或 ]
    for a, b in (("{", "}"), ("[", "]")):
        i, j = candidate.find(a), candidate.rfind(b)
        if i != -1 and j > i:
            try:
                return json.loads(candidate[i:j + 1])
            except json.JSONDecodeError:
                continue
    raise LLMError("模型未返回有效 JSON，请重试或更换模型。\n原始输出：" + text[:500])
