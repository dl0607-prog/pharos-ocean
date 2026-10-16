"""数据层：SQLAlchemy ORM，模型即表结构，读写全部走 ORM 会话（不使用原生 SQL）。"""
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
