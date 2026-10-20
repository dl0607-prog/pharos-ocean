"""应用入口：FastAPI + 前端静态托管 + 账号/智能体/对话/出海启动/平台对接 API。"""
import json
import re
from typing import Any, Dict

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import (FileResponse, HTMLResponse, RedirectResponse,
                               StreamingResponse)
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

MOBILE_UA = re.compile(r"iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry", re.I)


@app.middleware("http")
async def mobile_redirect(request: Request, call_next):
    """手机浏览器访问首页时自动进入移动端 /m（?desktop=1 可强制桌面版）。"""
    if request.url.path == "/" and not request.query_params.get("desktop"):
        ua = request.headers.get("user-agent", "")
        if MOBILE_UA.search(ua):
            return RedirectResponse(url="/m/", status_code=307)
    return await call_next(request)

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
    """对外只返回脱敏信息：任何客户端都不能拿到明文 API Key。"""
    return {
        "llm_base_url": config.LLM_BASE_URL,
        "llm_model": config.LLM_MODEL,
        "llm_key_masked": _masked(config.LLM_API_KEY),
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
    plan = database.get_plan(scope(user))
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
    plan = database.save_plan(scope(user), body.step,
                              json.dumps(body.answers, ensure_ascii=False))
    return {"step": plan["step"], "answers": body.answers}


@app.post("/api/launch/generate")
async def generate_plan(user: dict = Depends(auth.current_user)):
    plan = database.get_plan(scope(user))
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
    database.save_plan_result(scope(user), json.dumps(result, ensure_ascii=False))
    # 产物库：出海方案自动归档
    try:
        route = (result.get("route") or {}).get("primary") or "出海方案"
        database.add_artifact(scope(user), "plan", "出海方案 · " + str(route)[:40],
                              json.dumps(result, ensure_ascii=False),
                              "出海启动", "")
    except Exception:
        pass
    return {"result": result}


class FirstOrderBody(BaseModel):
    done: bool = True


@app.post("/api/launch/first-order")
def first_order(body: FirstOrderBody, user: dict = Depends(auth.current_user)):
    plan = database.set_first_order(scope(user), body.done)
    if plan is None:
        raise HTTPException(status_code=404, detail="尚未创建出海计划")
    return {"first_order": plan["first_order"]}


# ── 平台对接中心 ─────────────────────────────────────────────────────

@app.get("/api/launch/platforms")
def list_platforms(user: dict = Depends(auth.current_user)):
    links = {l["platform_id"]: l for l in database.list_links(scope(user))}
    verifies = database.link_verify_map(scope(user))
    merged = []
    for p in platforms.PLATFORMS:
        link = links.get(p["id"], {})
        ver = verifies.get(p["id"], {})
        merged.append({
            "id": p["id"], "name": p["name"], "ico": p["ico"],
            "region": p["region"], "mode": p["mode"], "fees": p["fees"],
            "entry": p["entry"], "fit": p["fit"], "tips": p["tips"],
            "status": link.get("status", "none"),
            "store_url": link.get("store_url", ""),
            "notes": link.get("notes", ""),
            "verified": ver.get("verified", False),
            "verify_note": ver.get("note", ""),
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
    link = database.save_link(scope(user), pid, status,
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
    plan = database.get_plan(scope(user))
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


# ── 团队 / 工作区 / 项目（原版团队视图的真实后端）────────────────────

def scope(user: dict) -> int:
    """团队数据域：加入团队后，读写都落在团队所有者名下（成员共享同一份数据）。"""
    return database.team_scope(user["id"])


class MemberBody(BaseModel):
    ws: str = ""
    name: str = ""
    role: str = "member"
    title: str = ""


class TeamBody(BaseModel):
    workspaces: list = []
    members: list = []
    projects: list = []


class InviteBody(BaseModel):
    role: str = "member"


class JoinBody(BaseModel):
    code: str = ""


class BindingBody(BaseModel):
    provider: str = ""
    account: str = ""
    note: str = ""


@app.get("/api/team")
def get_team(user: dict = Depends(auth.current_user)):
    team = database.seed_team(scope(user), user.get("company") or "", user["username"])
    team["me_role"] = database.team_role(user["id"])
    team["me_username"] = user["username"]
    team["team_owner_id"] = scope(user)
    return team


@app.post("/api/team/invite")
def create_invite(body: InviteBody, user: dict = Depends(auth.current_user)):
    if database.team_role(user["id"]) != "owner":
        raise HTTPException(status_code=403, detail="只有团队负责人可以邀请成员")
    inv = database.create_invite(scope(user), body.role)
    inv["link_mobile"] = "/m/?join=" + inv["code"]
    inv["link_pc"] = "/?join=" + inv["code"]
    return inv


@app.post("/api/team/join")
def join_team(body: JoinBody, user: dict = Depends(auth.current_user)):
    try:
        info = database.join_by_invite(user["id"], body.code)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    # 加入团队后，本次会话直接返回团队数据
    team = database.seed_team(scope(user), user.get("company") or "", user["username"])
    team["joined"] = info
    return team


@app.post("/api/team/leave")
def leave_team(user: dict = Depends(auth.current_user)):
    database.leave_team(user["id"])
    return {"ok": True}


@app.post("/api/team/members")
def add_member(body: MemberBody, user: dict = Depends(auth.current_user)):
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="成员姓名不能为空")
    team = database.get_team(scope(user))
    ws = body.ws or (team["workspaces"][0]["id"] if team["workspaces"] else "")
    member = database.add_member(scope(user), ws, name[:60],
                                 (body.role or "member")[:20],
                                 (body.title or "成员")[:60])
    return {"member": member}


@app.put("/api/team/members/{mid}")
def update_member(mid: str, body: MemberBody, user: dict = Depends(auth.current_user)):
    member = database.update_member(scope(user), mid, (body.name or "").strip()[:60],
                                    (body.role or "")[:20], (body.title or "").strip()[:60])
    if member is None:
        raise HTTPException(status_code=404, detail="成员不存在")
    return {"member": member}


@app.delete("/api/team/members/{mid}")
def remove_member(mid: str, user: dict = Depends(auth.current_user)):
    if database.team_role(user["id"]) != "owner":
        raise HTTPException(status_code=403, detail="只有团队负责人可以移除成员")
    if not database.delete_member(scope(user), mid):
        raise HTTPException(status_code=404, detail="成员不存在")
    return {"ok": True}


@app.put("/api/team")
def save_team(body: TeamBody, user: dict = Depends(auth.current_user)):
    return database.replace_team(scope(user), body.workspaces, body.members, body.projects)


# ── 工作接入：绑定飞书 / 企微 / 邮箱 / 平台账号 → 每日待办 ──────────

@app.get("/api/workhub")
def workhub(user: dict = Depends(auth.current_user)):
    sc = scope(user)
    bindings = database.list_bindings(sc)
    plan = database.get_plan(sc)
    links = {l["platform_id"]: l for l in database.list_links(sc)}
    tasks = []
    # 由真实业务数据推导待办（不伪造外部消息）
    for pid, info in [(p["id"], p) for p in platforms.PLATFORMS]:
        st = (links.get(pid) or {}).get("status", "none")
        if st in ("none", "preparing"):
            tasks.append({"source": "平台对接", "title": "完成 " + info["name"] + " 入驻资料",
                          "detail": info["entry"][0] if info.get("entry") else "",
                          "priority": "high" if st == "none" else "mid"})
    if plan and plan.get("answers_json") and plan["answers_json"] != "{}":
        result = plan.get("result_json") or ""
        if not result:
            tasks.append({"source": "出海计划", "title": "生成出海方案（资料已填写）",
                          "detail": "资料已就绪，点生成即可得到平台选择与预算", "priority": "high"})
    if plan and plan.get("first_order") == 0 and plan.get("result_json"):
        tasks.append({"source": "里程碑", "title": "推进到首次出单",
                      "detail": "按方案完成阶段任务，出单后标记里程碑", "priority": "mid"})
    for b in bindings:
        tasks.append({"source": "工作接入 · " + b["provider"], "title": "查看 " + b["account"] + " 的消息",
                      "detail": "已绑定账号；外部消息同步需在服务商侧授权后接入", "priority": "low"})
    return {"bindings": bindings, "tasks": tasks, "connected": len(bindings) > 0}


@app.post("/api/workhub/bind")
def bind_work(body: BindingBody, user: dict = Depends(auth.current_user)):
    provider = (body.provider or "").strip()
    account = (body.account or "").strip()
    if not provider or not account:
        raise HTTPException(status_code=400, detail="请填写渠道与账号")
    return {"binding": database.add_binding(scope(user), provider[:30], account[:120],
                                            (body.note or "").strip()[:200])}


@app.delete("/api/workhub/bind/{bid}")
def unbind_work(bid: int, user: dict = Depends(auth.current_user)):
    if not database.delete_binding(scope(user), bid):
        raise HTTPException(status_code=404, detail="绑定不存在")
    return {"ok": True}


# ── 平台店铺链接验证（真的去访问一次，证明链接可用）────────────────

class VerifyBody(BaseModel):
    store_url: str = ""


@app.post("/api/launch/platforms/{pid}/verify")
async def verify_store(pid: str, body: VerifyBody, user: dict = Depends(auth.current_user)):
    if pid not in platforms.PLATFORMS_BY_ID:
        raise HTTPException(status_code=404, detail="平台不存在")
    url = (body.store_url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="请先填写店铺链接")
    try:
        url = config.validate_llm_base_url(url)   # http/https + 拒绝环回/私网（防 SSRF）
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    import httpx
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "PHAROS-Verify/1.0"})
        title = ""
        text = resp.text[:4000]
        if "<title" in text.lower():
            import re as _re
            m = _re.search(r"<title[^>]*>(.*?)</title>", text, _re.I | _re.S)
            if m:
                title = _re.sub(r"\s+", " ", m.group(1)).strip()[:80]
        ok = resp.status_code < 400
        note = f"HTTP {resp.status_code}" + ((" · " + title) if title else "")
        database.save_link_verify(scope(user), pid, ok, note)
        return {"ok": ok, "status": resp.status_code, "title": title,
                "final_url": str(resp.url), "note": note}
    except httpx.RequestError as e:
        database.save_link_verify(scope(user), pid, False, "无法访问：" + str(e)[:120])
        raise HTTPException(status_code=502, detail="无法访问该链接：" + str(e)[:160])


@app.get("/api/projects/members")
def project_members(project_id: str = "", user: dict = Depends(auth.current_user)):
    return {"members": database.list_project_members(scope(user), project_id)}


class ProjectInviteBody(BaseModel):
    project_id: str = ""
    username: str = ""


@app.post("/api/projects/members")
def add_project_member(body: ProjectInviteBody, user: dict = Depends(auth.current_user)):
    name = (body.username or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="请输入要邀请的同事用户名")
    if database.find_user(name) is None:
        raise HTTPException(status_code=404, detail="该用户名还没注册，请先让对方注册")
    return {"member": database.add_project_member(scope(user), body.project_id, name)}


# ── 通用业务记录（补货单 / 证书 / 店铺 / 其他单据）─────────────────

class RecordBody(BaseModel):
    kind: str = ""
    title: str = ""
    payload: dict = {}


class UrlBody(BaseModel):
    url: str = ""


@app.get("/api/records")
def list_records(kind: str = "", user: dict = Depends(auth.current_user)):
    return {"records": database.list_records(scope(user), kind)}


@app.post("/api/records")
def add_record(body: RecordBody, user: dict = Depends(auth.current_user)):
    kind = (body.kind or "").strip()
    title = (body.title or "").strip()
    if not kind or not title:
        raise HTTPException(status_code=400, detail="请填写标题")
    return {"record": database.add_record(scope(user), kind[:20], title[:200],
                                          body.payload or {})}


@app.delete("/api/records/{rid}")
def remove_record(rid: int, user: dict = Depends(auth.current_user)):
    if not database.delete_record(scope(user), rid):
        raise HTTPException(status_code=404, detail="记录不存在")
    return {"ok": True}


@app.post("/api/verify-url")
async def verify_url(body: UrlBody, user: dict = Depends(auth.current_user)):
    """通用链接验证：真的访问一次，证明店铺/证书链接可用（拒绝内网，防 SSRF）。"""
    url = (body.url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="请填写链接")
    try:
        url = config.validate_llm_base_url(url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    import httpx
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "PHAROS-Verify/1.0"})
        import re as _re
        title = ""
        m = _re.search(r"<title[^>]*>(.*?)</title>", resp.text[:4000], _re.I | _re.S)
        if m:
            title = _re.sub(r"\s+", " ", m.group(1)).strip()[:80]
        return {"ok": resp.status_code < 400, "status": resp.status_code,
                "title": title, "final_url": str(resp.url)}
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail="无法访问该链接：" + str(e)[:160])


# ── 知识库：上传 → 切分 → 检索 → 供 AI 引用 ───────────────────────

class KbBody(BaseModel):
    title: str = ""
    tag: str = "其他"
    content: str = ""


def _chunk_text(text: str, size: int = 800) -> list:
    text = (text or "").replace("\r\n", "\n").strip()
    if not text:
        return []
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks, buf = [], ""
    for p in paras:
        if len(buf) + len(p) + 2 <= size:
            buf = (buf + "\n\n" + p).strip()
        else:
            if buf:
                chunks.append(buf)
            buf = p
    if buf:
        chunks.append(buf)
    return chunks


@app.get("/api/kb")
def list_kb(user: dict = Depends(auth.current_user)):
    return {"docs": database.list_kb_docs(scope(user))}


@app.post("/api/kb")
def add_kb(body: KbBody, user: dict = Depends(auth.current_user)):
    title = (body.title or "").strip()
    content = (body.content or "").strip()
    if not title or not content:
        raise HTTPException(status_code=400, detail="请填写标题和内容")
    if len(content) > 500_000:
        raise HTTPException(status_code=400, detail="文档过大（上限约 50 万字）")
    chunks = _chunk_text(content)
    return {"doc": database.add_kb_doc(scope(user), title, body.tag or "其他",
                                       content, len(chunks))}


@app.delete("/api/kb/{did}")
def remove_kb(did: int, user: dict = Depends(auth.current_user)):
    if not database.delete_kb_doc(scope(user), did):
        raise HTTPException(status_code=404, detail="文档不存在")
    return {"ok": True}


@app.get("/api/kb/search")
def search_kb(q: str = "", user: dict = Depends(auth.current_user)):
    return {"results": database.search_kb(scope(user), q)}


# ── 产物库：AI 产出自动归档 + 手动保存/查看/删除 ─────────────────────

class ArtifactBody(BaseModel):
    kind: str = "doc"
    title: str = ""
    content: str = ""
    source: str = ""
    project_id: str = ""


@app.get("/api/artifacts")
def list_artifacts(kind: str = "", user: dict = Depends(auth.current_user)):
    return {"artifacts": database.list_artifacts(scope(user), kind)}


@app.get("/api/artifacts/{aid}")
def get_artifact(aid: int, user: dict = Depends(auth.current_user)):
    a = database.get_artifact(scope(user), aid)
    if a is None:
        raise HTTPException(status_code=404, detail="产物不存在")
    return {"artifact": a}


@app.post("/api/artifacts")
def add_artifact(body: ArtifactBody, user: dict = Depends(auth.current_user)):
    title = (body.title or "").strip()
    content = body.content or ""
    if not title or not content:
        raise HTTPException(status_code=400, detail="标题和内容不能为空")
    return {"artifact": database.add_artifact(scope(user), (body.kind or "doc")[:30],
                                              title, content, body.source, body.project_id)}


@app.delete("/api/artifacts/{aid}")
def remove_artifact(aid: int, user: dict = Depends(auth.current_user)):
    if not database.delete_artifact(scope(user), aid):
        raise HTTPException(status_code=404, detail="产物不存在")
    return {"ok": True}


# ── 前端静态托管 ───────────────────────────────────────────────────

if config.FRONTEND_DIR.exists():
    mobile_dir = config.FRONTEND_DIR / "m"
    if mobile_dir.exists():
        app.mount("/m", StaticFiles(directory=str(mobile_dir), html=True), name="mobile")
    app.mount("/assets", StaticFiles(directory=str(config.FRONTEND_DIR)), name="assets")

    @app.get("/")
    def index():
        index_html = config.FRONTEND_DIR / "index.html"
        if index_html.exists():
            return FileResponse(str(index_html))
        return HTMLResponse("<h3>PHAROS 出海工作台：前端未找到（frontend/index.html）</h3>")
