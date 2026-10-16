"""应用入口：FastAPI + 前端静态托管 + 账号/智能体/对话/出海启动/平台对接 API。"""
import json
from typing import Any, Dict

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import agents, auth, config, database, llm, platforms

app = FastAPI(title="PHAROS 出海工作台", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_MESSAGE_CHARS = 8000
MAX_HISTORY_MESSAGES = 24


@app.on_event("startup")
def startup():
    database.init_db()


# ── 公开接口（部署健康检查用，登录前可访问）────────────────────────────

@app.get("/api/health")
def health():
    return {"ok": True, "version": "2.0.0", "llm_configured": llm.configured()}


# ── 账号体系：注册 / 登录 / 退出 ──────────────────────────────────────

class RegisterBody(BaseModel):
    username: str
    password: str
    company: str = ""


class LoginBody(BaseModel):
    username: str
    password: str


@app.post("/api/auth/register")
def register(body: RegisterBody):
    try:
        user = auth.register(body.username, body.password, body.company)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    token = auth.issue_token(user["id"])
    return {"token": token, "user": user}


@app.post("/api/auth/login")
def login(body: LoginBody):
    try:
        return auth.login(body.username, body.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/auth/logout")
def logout(user: dict = Depends(auth.current_user), authorization: str = Depends(auth.bearer_token)):
    auth.logout(authorization)
    return {"ok": True}


@app.get("/api/auth/me")
def me(user: dict = Depends(auth.current_user)):
    return {"user": user}


@app.post("/api/auth/onboarded")
def onboarded(user: dict = Depends(auth.current_user)):
    database.set_onboarded(user["id"])
    return {"ok": True}


# ── 智能体 ───────────────────────────────────────────────────────────

@app.get("/api/agents")
def list_agents(user: dict = Depends(auth.current_user)):
    return {"agents": agents.public_view()}


# ── AI 服务设置：界面保存 Base URL / Key / 模型，立即生效并持久化 ───────

class LLMSettings(BaseModel):
    llm_base_url: str = ""
    llm_api_key: str = ""
    llm_model: str = ""
    llm_temperature: str = ""
    llm_timeout: str = ""


def _masked(key: str) -> str:
    return (key[:6] + "***") if key else ""


def _settings_view() -> dict:
    return {
        "llm_base_url": config.LLM_BASE_URL,
        "llm_model": config.LLM_MODEL,
        "llm_key_masked": _masked(config.LLM_API_KEY),
        # 已登录用户可见明文 Key：用于把服务端配置下发到浏览器端应用（一处配置，全员可用）
        "llm_api_key": config.LLM_API_KEY,
        "llm_temperature": config.LLM_TEMPERATURE,
        "llm_timeout": config.LLM_TIMEOUT,
        "llm_configured": llm.configured(),
    }


@app.get("/api/settings")
def get_settings(user: dict = Depends(auth.current_user)):
    return _settings_view()


@app.post("/api/settings")
def save_settings(body: LLMSettings, user: dict = Depends(auth.current_user)):
    try:
        config.save_llm_settings(body.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {**_settings_view(), "saved": True}


@app.post("/api/settings/test")
async def test_settings(user: dict = Depends(auth.current_user)):
    if not llm.configured():
        raise HTTPException(status_code=400, detail="尚未配置 API Key，请先保存配置")
    try:
        reply = await llm.test_connection()
    except llm.LLMNotConfigured as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except llm.LLMError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"ok": True, "reply": reply}


# ── 对话管理（按用户隔离）────────────────────────────────────────────

class ConvCreate(BaseModel):
    agent_id: str = "command"
    title: str = ""


@app.get("/api/conversations")
def list_conversations(user: dict = Depends(auth.current_user)):
    return {"conversations": database.list_conversations(user["id"])}


@app.post("/api/conversations")
def create_conversation(body: ConvCreate, user: dict = Depends(auth.current_user)):
    agent_id = body.agent_id if body.agent_id in agents.AGENTS_BY_ID else "command"
    conv = database.create_conversation(user["id"], agent_id, (body.title or "").strip())
    return {**conv, "messages": []}


@app.get("/api/conversations/{conv_id}")
def get_conversation(conv_id: str, user: dict = Depends(auth.current_user)):
    conv = database.get_conversation(conv_id, user["id"])
    if conv is None:
        raise HTTPException(status_code=404, detail="对话不存在")
    return {**conv, "messages": database.list_messages(conv_id)}


@app.delete("/api/conversations/{conv_id}")
def delete_conversation(conv_id: str, user: dict = Depends(auth.current_user)):
    if not database.delete_conversation(conv_id, user["id"]):
        raise HTTPException(status_code=404, detail="对话不存在")
    return {"ok": True}


# ── 发送消息（SSE 流式回复）───────────────────────────────────────────

class SendBody(BaseModel):
    message: str


def _sse(payload: dict) -> str:
    return "data: " + json.dumps(payload, ensure_ascii=False) + "\n\n"


@app.post("/api/conversations/{conv_id}/send")
async def send_message(conv_id: str, body: SendBody, user: dict = Depends(auth.current_user)):
    conv = database.get_conversation(conv_id, user["id"])
    if conv is None:
        raise HTTPException(status_code=404, detail="对话不存在")
    message = (body.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="消息不能为空")
    if len(message) > MAX_MESSAGE_CHARS:
        raise HTTPException(status_code=400, detail="消息过长，请精简后重试")
    if not llm.configured():
        raise HTTPException(status_code=400, detail="尚未配置 AI 服务：请点击右上角 ⚙ 按钮，粘贴你的 API Key")

    database.add_message(conv_id, "user", message)
    if not conv["title"]:
        database.set_title(conv_id, message[:24])

    history = database.list_messages(conv_id)
    llm_messages = [{"role": "system", "content": agents.system_prompt(conv["agent_id"])}]
    llm_messages += [
        {"role": m["role"], "content": m["content"]}
        for m in history[-MAX_HISTORY_MESSAGES:]
    ]

    async def gen():
        yield _sse({"type": "start"})
        full = ""
        try:
            async for delta in llm.stream_chat(llm_messages):
                full += delta
                yield _sse({"type": "token", "text": delta})
            if full:
                database.add_message(conv_id, "assistant", full)
            yield _sse({"type": "done", "text": full})
        except llm.LLMNotConfigured as e:
            yield _sse({"type": "error", "code": "not_configured", "message": str(e)})
        except llm.LLMError as e:
            yield _sse({"type": "error", "code": "llm", "message": str(e)})
        except Exception as e:  # 兜底：任何异常都转为 SSE 事件，不让连接裸断
            yield _sse({"type": "error", "code": "unknown", "message": "服务异常：" + str(e)})

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── 出海启动：资料填写 → AI 生成方案 → 首单里程碑 ────────────────────

def _parse_json_field(text: str) -> Any:
    if not text:
        return {}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {}


@app.get("/api/launch/plan")
def get_plan(user: dict = Depends(auth.current_user)):
    plan = database.get_plan(user["id"])
    if plan is None:
        return {"step": 0, "answers": {}, "result": None, "first_order": False}
    return {
        "step": plan["step"],
        "answers": _parse_json_field(plan["answers_json"]),
        "result": _parse_json_field(plan["result_json"]) or None,
        "first_order": plan["first_order"],
    }


class PlanBody(BaseModel):
    step: int = 0
    answers: Dict[str, Any] = {}


@app.put("/api/launch/plan")
def save_plan(body: PlanBody, user: dict = Depends(auth.current_user)):
    plan = database.save_plan(user["id"], body.step,
                              json.dumps(body.answers, ensure_ascii=False))
    return {"step": plan["step"], "answers": body.answers}


@app.post("/api/launch/generate")
async def generate_plan(user: dict = Depends(auth.current_user)):
    plan = database.get_plan(user["id"])
    if plan is None or not _parse_json_field(plan["answers_json"]):
        raise HTTPException(status_code=400, detail="请先完成出海资料填写，再生成方案")
    if not llm.configured():
        raise HTTPException(status_code=400, detail="尚未配置 AI 服务：请点击右上角 ⚙ 按钮，粘贴你的 API Key")
    answers = _parse_json_field(plan["answers_json"])
    try:
        result = await llm.chat_json(agents.build_plan_messages(answers), max_tokens=6000)
    except llm.LLMNotConfigured as e:
        raise HTTPException(status_code=400, detail=str(e))
    except llm.LLMError as e:
        raise HTTPException(status_code=502, detail=str(e))
    if not isinstance(result, dict) or not result.get("route"):
        raise HTTPException(status_code=502, detail="AI 返回的方案格式异常，请重试")
    database.save_plan_result(user["id"], json.dumps(result, ensure_ascii=False))
    return {"result": result}


class FirstOrderBody(BaseModel):
    done: bool = True


@app.post("/api/launch/first-order")
def first_order(body: FirstOrderBody, user: dict = Depends(auth.current_user)):
    plan = database.set_first_order(user["id"], body.done)
    if plan is None:
        raise HTTPException(status_code=404, detail="尚未创建出海计划")
    return {"first_order": plan["first_order"]}


# ── 平台对接中心 ─────────────────────────────────────────────────────

@app.get("/api/launch/platforms")
def list_platforms(user: dict = Depends(auth.current_user)):
    links = {l["platform_id"]: l for l in database.list_links(user["id"])}
    merged = []
    for p in platforms.PLATFORMS:
        link = links.get(p["id"], {})
        merged.append({
            "id": p["id"], "name": p["name"], "ico": p["ico"],
            "region": p["region"], "mode": p["mode"], "fees": p["fees"],
            "entry": p["entry"], "fit": p["fit"], "tips": p["tips"],
            "status": link.get("status", "none"),
            "store_url": link.get("store_url", ""),
            "notes": link.get("notes", ""),
            "updated_at": link.get("updated_at", 0),
        })
    return {"platforms": merged, "status_labels": platforms.PLATFORM_STATUS}


class LinkBody(BaseModel):
    status: str = "none"
    store_url: str = ""
    notes: str = ""


@app.put("/api/launch/platforms/{pid}")
def save_link(pid: str, body: LinkBody, user: dict = Depends(auth.current_user)):
    if pid not in platforms.PLATFORMS_BY_ID:
        raise HTTPException(status_code=404, detail="平台不存在")
    status = body.status if body.status in platforms.PLATFORM_STATUS else "none"
    link = database.save_link(user["id"], pid, status,
                              (body.store_url or "").strip()[:300],
                              (body.notes or "").strip()[:2000])
    return link


@app.post("/api/launch/platforms/{pid}/guide")
async def platform_guide(pid: str, user: dict = Depends(auth.current_user)):
    platform = platforms.PLATFORMS_BY_ID.get(pid)
    if platform is None:
        raise HTTPException(status_code=404, detail="平台不存在")
    if not llm.configured():
        raise HTTPException(status_code=400, detail="尚未配置 AI 服务：请点击右上角 ⚙ 按钮，粘贴你的 API Key")
    plan = database.get_plan(user["id"])
    answers = _parse_json_field(plan["answers_json"]) if plan else {}
    try:
        result = await llm.chat_json(agents.build_guide_messages(platform, answers), max_tokens=5000)
    except llm.LLMNotConfigured as e:
        raise HTTPException(status_code=400, detail=str(e))
    except llm.LLMError as e:
        raise HTTPException(status_code=502, detail=str(e))
    if not isinstance(result, dict) or not result.get("steps"):
        raise HTTPException(status_code=502, detail="AI 返回的指南格式异常，请重试")
    return {"guide": result}


# ── 前端静态托管 ───────────────────────────────────────────────────

if config.FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(config.FRONTEND_DIR)), name="assets")

    @app.get("/")
    def index():
        index_html = config.FRONTEND_DIR / "index.html"
        if index_html.exists():
            return FileResponse(str(index_html))
        return HTMLResponse("<h3>PHAROS 出海工作台：前端未找到（frontend/index.html）</h3>")
