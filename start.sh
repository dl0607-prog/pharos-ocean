#!/bin/bash
# PHAROS 出海工作台 一键启动脚本（在本机运行）
set -e
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  echo "[1/3] 创建虚拟环境…"
  python3 -m venv .venv
  .venv/bin/pip install -q -r backend/requirements.txt
else
  echo "[1/3] 虚拟环境已就绪"
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "[2/3] 已生成 .env（未填 LLM_API_KEY 时，可打开页面后点右上角 ⚙ 在界面里配置）"
else
  echo "[2/3] .env 已存在"
fi

echo "[3/3] 启动服务：本机 http://localhost:8320"
cd backend
exec ../.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8320
