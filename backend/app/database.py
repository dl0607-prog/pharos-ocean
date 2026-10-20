"""数据层：SQLAlchemy ORM，模型即表结构，读写全部走 ORM 会话（不使用原生 SQL）。"""
import json
import time
import uuid
from contextlib import contextmanager
from typing import List, Optional

from sqlalchemy import String, Text, create_engine
from sqlalchemy.orm import (DeclarativeBase, Mapped, Session, mapped_column,
                            sessionmaker)

from . import config


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    pass_hash: Mapped[str] = mapped_column(String(200), default="")
    pass_salt: Mapped[str] = mapped_column(String(40), default="")
    company: Mapped[str] = mapped_column(String(100), default="")
    onboarded: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[float] = mapped_column(default=0.0)


class TeamMembership(Base):
    """成员 → 团队所有者的归属关系（加入团队后共享同一份数据）。"""
    __tablename__ = "team_memberships"
    user_id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(index=True)
    role: Mapped[str] = mapped_column(String(20), default="member")
    joined_at: Mapped[float] = mapped_column(default=0.0)


class PlatformVerify(Base):
    __tablename__ = "platform_verify"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_id: Mapped[int] = mapped_column(index=True)
    platform_id: Mapped[str] = mapped_column(String(40), default="")
    verified: Mapped[int] = mapped_column(default=0)
    note: Mapped[str] = mapped_column(String(300), default="")
    verified_at: Mapped[float] = mapped_column(default=0.0)


class TeamInvite(Base):
    __tablename__ = "team_invites"
    code: Mapped[str] = mapped_column(String(12), primary_key=True)
    owner_id: Mapped[int] = mapped_column(index=True)
    role: Mapped[str] = mapped_column(String(20), default="member")
    created_at: Mapped[float] = mapped_column(default=0.0)
    expires_at: Mapped[float] = mapped_column(default=0.0)
    used_by: Mapped[Optional[int]] = mapped_column(default=None)


class OpsRecord(Base):
    """通用业务记录：补货单 / 证书 / 店铺 / 其他运营单据。"""
    __tablename__ = "ops_records"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_id: Mapped[int] = mapped_column(index=True)
    kind: Mapped[str] = mapped_column(String(20), default="")
    title: Mapped[str] = mapped_column(String(200), default="")
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[float] = mapped_column(default=0.0)


class WorkBinding(Base):
    __tablename__ = "work_bindings"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_id: Mapped[int] = mapped_column(index=True)
    provider: Mapped[str] = mapped_column(String(30), default="")
    account: Mapped[str] = mapped_column(String(120), default="")
    note: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[float] = mapped_column(default=0.0)


class AuthToken(Base):
    __tablename__ = "auth_tokens"
    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(index=True)
    created_at: Mapped[float] = mapped_column(default=0.0)
    expires_at: Mapped[float] = mapped_column(default=0.0)


class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    user_id: Mapped[int] = mapped_column(default=0, index=True)
    agent_id: Mapped[str] = mapped_column(String(32), default="command")
    title: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[float] = mapped_column(default=0.0)
    last_at: Mapped[float] = mapped_column(default=0.0)


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    conv_id: Mapped[str] = mapped_column(String(16), index=True)
    role: Mapped[str] = mapped_column(String(16), default="user")
    content: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[float] = mapped_column(default=0.0)


class GoPlan(Base):
    __tablename__ = "go_plans"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(index=True)
    step: Mapped[int] = mapped_column(default=0)
    answers_json: Mapped[str] = mapped_column(Text, default="{}")
    result_json: Mapped[str] = mapped_column(Text, default="")
    first_order: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[float] = mapped_column(default=0.0)
    updated_at: Mapped[float] = mapped_column(default=0.0)


class PlatformLink(Base):
    __tablename__ = "platform_links"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(index=True)
    platform_id: Mapped[str] = mapped_column(String(40), default="")
    status: Mapped[str] = mapped_column(String(20), default="none")
    store_url: Mapped[str] = mapped_column(String(300), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[float] = mapped_column(default=0.0)


class Workspace(Base):
    __tablename__ = "workspaces"
    id: Mapped[str] = mapped_column(String(24), primary_key=True)
    user_id: Mapped[int] = mapped_column(index=True)
    name: Mapped[str] = mapped_column(String(100), default="")
    short: Mapped[str] = mapped_column(String(10), default="")
    plan: Mapped[str] = mapped_column(String(40), default="")
    owner_id: Mapped[str] = mapped_column(String(24), default="")
    desc: Mapped[str] = mapped_column(Text, default="")


class Member(Base):
    __tablename__ = "members"
    id: Mapped[str] = mapped_column(String(24), primary_key=True)
    user_id: Mapped[int] = mapped_column(index=True)
    ws: Mapped[str] = mapped_column(String(24), default="")
    name: Mapped[str] = mapped_column(String(100), default="")
    role: Mapped[str] = mapped_column(String(20), default="member")
    title: Mapped[str] = mapped_column(String(60), default="")


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String(24), primary_key=True)
    user_id: Mapped[int] = mapped_column(index=True)
    ws: Mapped[str] = mapped_column(String(24), default="")
    name: Mapped[str] = mapped_column(String(100), default="")
    product: Mapped[str] = mapped_column(String(100), default="")
    market: Mapped[str] = mapped_column(String(60), default="")
    platform: Mapped[str] = mapped_column(String(60), default="")
    created_at: Mapped[float] = mapped_column(default=0.0)


_engine = create_engine(
    "sqlite:///" + str(config.DB_PATH),
    connect_args={"check_same_thread": False},
)
_Session = sessionmaker(bind=_engine)


def init_db() -> None:
    Base.metadata.create_all(_engine)


@contextmanager
def session():
    s = _Session()
    try:
        yield s
        s.commit()
    finally:
        s.close()


# ── 用户与登录态 ─────────────────────────────────────────────

def create_user(username: str, pass_hash: str, pass_salt: str, company: str) -> dict:
    with session() as s:
        u = User(username=username, pass_hash=pass_hash, pass_salt=pass_salt,
                 company=company, created_at=time.time())
        s.add(u)
        s.flush()
        return _user_dict(u)


def find_user(username: str) -> Optional[dict]:
    """内部使用：返回含哈希/盐的完整字段，接口输出时用 user_public 过滤。"""
    with session() as s:
        u = s.query(User).filter(User.username == username).first()
        if u is None:
            return None
        return {"id": u.id, "username": u.username, "company": u.company,
                "onboarded": bool(u.onboarded), "created_at": u.created_at,
                "pass_hash": u.pass_hash, "pass_salt": u.pass_salt}


def user_public(u: dict) -> dict:
    return {k: v for k, v in u.items() if k not in ("pass_hash", "pass_salt")}


def save_token(token: str, user_id: int, expires_at: float) -> None:
    with session() as s:
        s.add(AuthToken(token=token, user_id=user_id,
                        created_at=time.time(), expires_at=expires_at))


def user_by_token(token: str) -> Optional[dict]:
    with session() as s:
        t = s.get(AuthToken, token)
        if t is None or t.expires_at < time.time():
            return None
        u = s.get(User, t.user_id)
        return _user_dict(u) if u else None


def drop_token(token: str) -> None:
    with session() as s:
        t = s.get(AuthToken, token)
        if t is not None:
            s.delete(t)


def set_onboarded(user_id: int) -> None:
    with session() as s:
        u = s.get(User, user_id)
        if u is not None:
            u.onboarded = 1


def _user_dict(u: User) -> dict:
    return {"id": u.id, "username": u.username, "company": u.company,
            "onboarded": bool(u.onboarded), "created_at": u.created_at}


def team_scope(user_id: int) -> int:
    """当前账号的数据归属：加入团队后，读写都落在团队所有者名下（共享）。"""
    with session() as s:
        m = s.get(TeamMembership, user_id)
        return m.owner_id if m is not None else user_id


def team_role(user_id: int) -> str:
    with session() as s:
        m = s.get(TeamMembership, user_id)
        return (m.role if m is not None else "owner") or "member"


# ── 团队邀请 ─────────────────────────────────────────────

def create_invite(owner_id: int, role: str, ttl_days: int = 7) -> dict:
    import secrets as _secrets
    code = _secrets.token_hex(3).upper()
    now = time.time()
    with session() as s:
        s.add(TeamInvite(code=code, owner_id=owner_id, role=role or "member",
                         created_at=now, expires_at=now + ttl_days * 86400))
    return {"code": code, "expires_at": now + ttl_days * 86400, "role": role or "member"}


def join_by_invite(user_id: int, code: str) -> dict:
    code = (code or "").strip().upper()
    with session() as s:
        inv = s.get(TeamInvite, code)
        if inv is None:
            raise ValueError("邀请码不存在")
        if inv.expires_at < time.time():
            raise ValueError("邀请码已过期，请让团队负责人重新生成")
        if inv.owner_id == user_id:
            raise ValueError("不能加入自己创建的团队")
        u = s.get(User, user_id)
        owner = s.get(User, inv.owner_id)
        if u is None or owner is None:
            raise ValueError("邀请码无效")
        m = s.get(TeamMembership, user_id)
        if m is None:
            s.add(TeamMembership(user_id=user_id, owner_id=inv.owner_id,
                                 role=inv.role or "member", joined_at=time.time()))
        else:
            m.owner_id = inv.owner_id
            m.role = inv.role or "member"
        inv.used_by = user_id
        exists = (s.query(Member)
                  .filter(Member.user_id == inv.owner_id, Member.name == u.username)
                  .first())
        if exists is None:
            team = s.query(Workspace).filter(Workspace.user_id == inv.owner_id).first()
            s.add(Member(id=uuid.uuid4().hex[:12], user_id=inv.owner_id,
                         ws=team.id if team else "", name=u.username,
                         role=inv.role or "member", title=inv.role or "member"))
        return {"owner_name": owner.username, "company": owner.company,
                "role": inv.role or "member", "code": code}


def leave_team(user_id: int) -> None:
    with session() as s:
        m = s.get(TeamMembership, user_id)
        if m is not None:
            s.delete(m)


# ── 工作接入（飞书/企微/邮箱/平台账号绑定）─────────────────

def list_bindings(owner_id: int) -> List[dict]:
    with session() as s:
        rows = (s.query(WorkBinding)
                .filter(WorkBinding.owner_id == owner_id)
                .order_by(WorkBinding.id.desc()).all())
        return [{"id": b.id, "provider": b.provider, "account": b.account,
                 "note": b.note, "created_at": b.created_at} for b in rows]


# ── 通用业务记录（补货单 / 证书 / 店铺）────────────────────

def list_records(owner_id: int, kind: str = "") -> List[dict]:
    with session() as s:
        q = s.query(OpsRecord).filter(OpsRecord.owner_id == owner_id)
        if kind:
            q = q.filter(OpsRecord.kind == kind)
        rows = q.order_by(OpsRecord.id.desc()).limit(100).all()
        return [{"id": r.id, "kind": r.kind, "title": r.title,
                 "payload": json.loads(r.payload_json or "{}"),
                 "created_at": r.created_at} for r in rows]


def add_record(owner_id: int, kind: str, title: str, payload: dict) -> dict:
    with session() as s:
        r = OpsRecord(owner_id=owner_id, kind=kind, title=title,
                      payload_json=json.dumps(payload, ensure_ascii=False),
                      created_at=time.time())
        s.add(r)
        s.flush()
        return {"id": r.id, "kind": r.kind, "title": r.title,
                "payload": payload, "created_at": r.created_at}


def delete_record(owner_id: int, rid: int) -> bool:
    with session() as s:
        r = s.query(OpsRecord).filter(OpsRecord.owner_id == owner_id,
                                      OpsRecord.id == rid).first()
        if r is None:
            return False
        s.delete(r)
        return True


def add_binding(owner_id: int, provider: str, account: str, note: str = "") -> dict:
    with session() as s:
        b = WorkBinding(owner_id=owner_id, provider=provider, account=account,
                        note=note, created_at=time.time())
        s.add(b)
        s.flush()
        return {"id": b.id, "provider": b.provider, "account": b.account,
                "note": b.note, "created_at": b.created_at}


def delete_binding(owner_id: int, bid: int) -> bool:
    with session() as s:
        b = s.query(WorkBinding).filter(WorkBinding.owner_id == owner_id,
                                        WorkBinding.id == bid).first()
        if b is None:
            return False
        s.delete(b)
        return True


def save_link_verify(owner_id: int, platform_id: str, verified: bool, note: str) -> None:
    with session() as s:
        v = (s.query(PlatformVerify)
             .filter(PlatformVerify.owner_id == owner_id,
                     PlatformVerify.platform_id == platform_id).first())
        if v is None:
            v = PlatformVerify(owner_id=owner_id, platform_id=platform_id)
            s.add(v)
        v.verified = 1 if verified else 0
        v.note = (note or "")[:300]
        v.verified_at = time.time()


def link_verify_map(owner_id: int) -> dict:
    with session() as s:
        rows = (s.query(PlatformVerify)
                .filter(PlatformVerify.owner_id == owner_id).all())
        return {r.platform_id: {"verified": bool(r.verified), "note": r.note,
                                "verified_at": r.verified_at} for r in rows}


# ── 对话与消息（按用户隔离）──────────────────────────────────

def _conv_dict(c: Conversation) -> dict:
    return {"id": c.id, "user_id": c.user_id, "agent_id": c.agent_id,
            "title": c.title, "created_at": c.created_at, "last_at": c.last_at}


def create_conversation(user_id: int, agent_id: str, title: str = "") -> dict:
    now = time.time()
    with session() as s:
        c = Conversation(id=uuid.uuid4().hex[:16], user_id=user_id,
                         agent_id=agent_id, title=title,
                         created_at=now, last_at=now)
        s.add(c)
        s.flush()
        return _conv_dict(c)


def list_conversations(user_id: int) -> List[dict]:
    with session() as s:
        rows = (s.query(Conversation)
                .filter(Conversation.user_id == user_id)
                .order_by(Conversation.last_at.desc())
                .all())
        return [_conv_dict(c) for c in rows]


def get_conversation(conv_id: str, user_id: int) -> Optional[dict]:
    with session() as s:
        c = s.get(Conversation, conv_id)
        if c is None or c.user_id != user_id:
            return None
        return _conv_dict(c)


def delete_conversation(conv_id: str, user_id: int) -> bool:
    with session() as s:
        c = s.get(Conversation, conv_id)
        if c is None or c.user_id != user_id:
            return False
        s.query(Message).filter(Message.conv_id == conv_id).delete()
        s.delete(c)
        return True


def set_title(conv_id: str, title: str) -> None:
    with session() as s:
        c = s.get(Conversation, conv_id)
        if c is not None:
            c.title = title


def add_message(conv_id: str, role: str, content: str) -> None:
    now = time.time()
    with session() as s:
        s.add(Message(conv_id=conv_id, role=role, content=content, created_at=now))
        c = s.get(Conversation, conv_id)
        if c is not None:
            c.last_at = now


def list_messages(conv_id: str) -> List[dict]:
    with session() as s:
        rows = (s.query(Message)
                .filter(Message.conv_id == conv_id)
                .order_by(Message.id)
                .all())
        return [{"id": m.id, "role": m.role, "content": m.content,
                 "created_at": m.created_at} for m in rows]


# ── 出海启动计划 ─────────────────────────────────────────────

def _plan_dict(p: GoPlan) -> dict:
    return {"step": p.step, "answers_json": p.answers_json,
            "result_json": p.result_json, "first_order": bool(p.first_order),
            "updated_at": p.updated_at}


def get_plan(user_id: int) -> Optional[dict]:
    with session() as s:
        p = s.query(GoPlan).filter(GoPlan.user_id == user_id).first()
        return _plan_dict(p) if p else None


def save_plan(user_id: int, step: int, answers_json: str) -> dict:
    now = time.time()
    with session() as s:
        p = s.query(GoPlan).filter(GoPlan.user_id == user_id).first()
        if p is None:
            p = GoPlan(user_id=user_id, step=step, answers_json=answers_json,
                       created_at=now, updated_at=now)
            s.add(p)
        else:
            p.step = step
            p.answers_json = answers_json
            p.updated_at = now
        s.flush()
        return _plan_dict(p)


def save_plan_result(user_id: int, result_json: str) -> dict:
    now = time.time()
    with session() as s:
        p = s.query(GoPlan).filter(GoPlan.user_id == user_id).first()
        if p is None:
            p = GoPlan(user_id=user_id, result_json=result_json,
                       created_at=now, updated_at=now)
            s.add(p)
        else:
            p.result_json = result_json
            p.updated_at = now
        s.flush()
        return _plan_dict(p)


def set_first_order(user_id: int, done: bool) -> dict:
    with session() as s:
        p = s.query(GoPlan).filter(GoPlan.user_id == user_id).first()
        if p is None:
            return None
        p.first_order = 1 if done else 0
        p.updated_at = time.time()
        s.flush()
        return _plan_dict(p)


# ── 平台对接状态 ─────────────────────────────────────────────

def _link_dict(l: PlatformLink) -> dict:
    return {"platform_id": l.platform_id, "status": l.status,
            "store_url": l.store_url, "notes": l.notes, "updated_at": l.updated_at}


def list_links(user_id: int) -> List[dict]:
    with session() as s:
        rows = s.query(PlatformLink).filter(PlatformLink.user_id == user_id).all()
        return [_link_dict(l) for l in rows]


def save_link(user_id: int, platform_id: str, status: str,
              store_url: str, notes: str) -> dict:
    now = time.time()
    with session() as s:
        l = (s.query(PlatformLink)
             .filter(PlatformLink.user_id == user_id,
                     PlatformLink.platform_id == platform_id)
             .first())
        if l is None:
            l = PlatformLink(user_id=user_id, platform_id=platform_id,
                             status=status, store_url=store_url,
                             notes=notes, updated_at=now)
            s.add(l)
        else:
            l.status = status
            l.store_url = store_url
            l.notes = notes
            l.updated_at = now
        s.flush()
        return _link_dict(l)


# ── 团队 / 工作区 / 项目（原版团队视图的真实后端）──────────────

def _ws_dict(w: Workspace) -> dict:
    return {"id": w.id, "name": w.name, "short": w.short, "plan": w.plan,
            "owner": w.owner_id, "desc": w.desc}


def _member_dict(m: Member) -> dict:
    return {"id": m.id, "ws": m.ws, "name": m.name, "role": m.role, "title": m.title}


def _project_dict(p: Project) -> dict:
    return {"id": p.id, "ws": p.ws, "name": p.name, "product": p.product,
            "market": p.market, "platform": p.platform}


def get_team(user_id: int) -> dict:
    with session() as s:
        ws = [_ws_dict(r) for r in s.query(Workspace).filter(Workspace.user_id == user_id).all()]
        ms = [_member_dict(r) for r in s.query(Member).filter(Member.user_id == user_id).all()]
        ps = [_project_dict(r) for r in s.query(Project).filter(Project.user_id == user_id).all()]
    return {"workspaces": ws, "members": ms, "projects": ps}


def seed_team(user_id: int, company: str, username: str) -> dict:
    """首次访问：为该数据域创建默认团队；名称一律取“团队所有者”的公司与用户名。"""
    with session() as s:
        owner = s.get(User, user_id)
        if owner is not None:
            company = owner.company or company
            username = owner.username or username
        exists = s.query(Workspace).filter(Workspace.user_id == user_id).first()
        if exists is not None:
            return get_team(user_id)
        ws_id = uuid.uuid4().hex[:12]
        owner_id = uuid.uuid4().hex[:12]
        prj_id = uuid.uuid4().hex[:12]
        wname = (company or "我的出海团队").strip()[:60]
        s.add(Workspace(id=ws_id, user_id=user_id, name=wname,
                        short=(username or "U")[:2], plan="Free",
                        owner_id=owner_id, desc="我的出海团队"))
        s.add(Member(id=owner_id, user_id=user_id, ws=ws_id, name=username or "我",
                     role="owner", title="Owner"))
        s.add(Project(id=prj_id, user_id=user_id, ws=ws_id,
                      name="第一个出海项目", product="待定", market="美国", platform="待定",
                      created_at=time.time()))
    return get_team(user_id)


def add_member(user_id: int, ws: str, name: str, role: str, title: str) -> dict:
    with session() as s:
        m = Member(id=uuid.uuid4().hex[:12], user_id=user_id, ws=ws,
                   name=name, role=role, title=title)
        s.add(m)
        s.flush()
        return _member_dict(m)


def update_member(user_id: int, mid: str, name: str, role: str, title: str):
    with session() as s:
        m = s.query(Member).filter(Member.user_id == user_id, Member.id == mid).first()
        if m is None:
            return None
        if name:
            m.name = name
        if role:
            m.role = role
        if title:
            m.title = title
        s.flush()
        return _member_dict(m)


def delete_member(user_id: int, mid: str) -> bool:
    with session() as s:
        m = s.query(Member).filter(Member.user_id == user_id, Member.id == mid).first()
        if m is None:
            return False
        s.delete(m)
        return True


def replace_team(user_id: int, workspaces, members, projects) -> dict:
    """整体替换用户的团队数据（本地新建工作区/项目后同步上来）。"""
    with session() as s:
        s.query(Project).filter(Project.user_id == user_id).delete()
        s.query(Member).filter(Member.user_id == user_id).delete()
        s.query(Workspace).filter(Workspace.user_id == user_id).delete()
        for w in (workspaces or []):
            s.add(Workspace(id=str(w.get("id") or uuid.uuid4().hex[:12]),
                            user_id=user_id, name=str(w.get("name") or "")[:100],
                            short=str(w.get("short") or "")[:10],
                            plan=str(w.get("plan") or "")[:40],
                            owner_id=str(w.get("owner") or "")[:24],
                            desc=str(w.get("desc") or "")[:500]))
        for m in (members or []):
            s.add(Member(id=str(m.get("id") or uuid.uuid4().hex[:12]),
                         user_id=user_id, ws=str(m.get("ws") or "")[:24],
                         name=str(m.get("name") or "")[:100],
                         role=str(m.get("role") or "member")[:20],
                         title=str(m.get("title") or "")[:60]))
        for p in (projects or []):
            s.add(Project(id=str(p.get("id") or uuid.uuid4().hex[:12]),
                          user_id=user_id, ws=str(p.get("ws") or "")[:24],
                          name=str(p.get("name") or "")[:100],
                          product=str(p.get("product") or "")[:100],
                          market=str(p.get("market") or "")[:60],
                          platform=str(p.get("platform") or "")[:60],
                          created_at=time.time()))
    return get_team(user_id)
