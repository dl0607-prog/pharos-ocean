"""账号体系：注册 / 登录 / 退出 / 会话校验（PBKDF2 加盐哈希，无外部依赖）。"""
import hashlib
import re
import secrets
import time

from fastapi import Header, HTTPException

from . import database

TOKEN_TTL = 30 * 24 * 3600        # 登录态 30 天
_USERNAME_RE = re.compile(r"^[0-9A-Za-z_\u4e00-\u9fa5]{2,20}$")


def hash_password(password: str, salt: str = "") -> tuple:
    """PBKDF2-SHA256 加盐哈希，返回 (hex 摘要, hex 盐)。"""
    if not salt:
        salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"),
        bytes.fromhex(salt), 120000,
    ).hex()
    return digest, salt


def register(username: str, password: str, company: str) -> dict:
    username = (username or "").strip()
    if not _USERNAME_RE.match(username):
        raise ValueError("用户名需为 2-20 位字母、数字、下划线或中文")
    if len(password or "") < 6:
        raise ValueError("密码至少 6 位")
    if len(password) > 64:
        raise ValueError("密码过长")
    if database.find_user(username) is not None:
        raise ValueError("该用户名已被注册")
    digest, salt = hash_password(password)
    return database.create_user(username, digest, salt, (company or "").strip()[:100])


def issue_token(user_id: int) -> str:
    token = secrets.token_hex(32)
    database.save_token(token, user_id, time.time() + TOKEN_TTL)
    return token


def login(username: str, password: str) -> dict:
    user = database.find_user((username or "").strip())
    if user is None:
        raise ValueError("用户名或密码不正确")
    digest, _ = hash_password(password or "", user["pass_salt"])
    if not secrets.compare_digest(digest, user["pass_hash"]):
        raise ValueError("用户名或密码不正确")
    return {"token": issue_token(user["id"]), "user": database.user_public(user)}


def logout(token: str) -> None:
    if token:
        database.drop_token(token)


def bearer_token(authorization: str = Header(default="")) -> str:
    if authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return ""


def current_user(authorization: str = Header(default="")) -> dict:
    """FastAPI 依赖：校验 Authorization: Bearer <token>，失败返回 401。"""
    token = bearer_token(authorization)
    user = database.user_by_token(token) if token else None
    if user is None:
        raise HTTPException(status_code=401, detail="登录已失效，请重新登录")
    return user
