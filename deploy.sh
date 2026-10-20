#!/usr/bin/env bash
# ============================================================
# PHAROS 出海工作台 · 云服务器一键部署脚本
# 适用:腾讯云轻量应用服务器 / CVM(Ubuntu、Debian、CentOS、TencentOS)
# 用法(在【服务器网页终端】里粘贴,不要在 Mac/Windows 本机终端运行):
#   curl -fsSL https://raw.githubusercontent.com/dl0607-prog/pharos-ocean/main/deploy.sh -o /tmp/pharos.sh && bash /tmp/pharos.sh
# 部署完成后浏览器访问 http://<服务器公网IP>:8088 即可。
# ============================================================

# 防呆:如果在本机 macOS 上运行,直接提示退出(避免装错机器)
if [ "$(uname)" = "Darwin" ]; then
  echo "⚠️ 检测到这是 Mac 电脑,不是云服务器。"
  echo "请回到浏览器里的轻量服务器控制台 → 点服务器卡片上的「登录」,"
  echo "在弹出的【网页终端】窗口中粘贴本命令。"
  exit 1
fi

set -e

# 需要 root 权限(不是 root 时自动提权)
if [ "$(id -u)" != "0" ]; then
  echo "需要管理员权限,正在提权…"
  exec sudo bash "$0"
fi

echo "==> [1/5] 检查 Python3 环境"
if ! command -v python3 >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq && apt-get install -y -qq python3 python3-venv python3-pip
  elif command -v yum >/dev/null 2>&1; then
    yum install -y -q python3 python3-pip
  fi
fi
if ! python3 -m venv --help >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    apt-get install -y -qq python3-venv python3-pip
  fi
fi
python3 --version

echo "==> [2/5] 下载最新版项目代码"
mkdir -p /opt && cd /opt
# 备份已有数据(重复部署/升级时保护对话记录、团队与配置不丢失)
BACKUP=/tmp/pharos-data-backup
rm -rf "$BACKUP" && mkdir -p "$BACKUP"
if [ -d pharos-ocean-main/data ]; then cp -a pharos-ocean-main/data "$BACKUP/"; fi
if [ -d pharos-ocean-main/frontend/m/assets ]; then cp -a pharos-ocean-main/frontend/m/assets "$BACKUP/assets" 2>/dev/null || true; fi

# 国内服务器访问 GitHub 不稳定：依次尝试多个镜像，任一成功即继续
PKG=/tmp/pharos-ocean.tar.gz
rm -f "$PKG"
GH_PATH="dl0607-prog/pharos-ocean/archive/refs/heads/main.tar.gz"
MIRRORS="
https://ghfast.top/https://github.com/$GH_PATH
https://gh-proxy.com/https://github.com/$GH_PATH
https://ghproxy.net/https://github.com/$GH_PATH
https://mirror.ghproxy.com/https://github.com/$GH_PATH
https://github.com/$GH_PATH
"
ok=0
for u in $MIRRORS; do
  echo "   尝试下载: $u"
  if curl -fL --retry 2 --retry-delay 2 --connect-timeout 15 -m 240 -o "$PKG" "$u"; then
    if tar tzf "$PKG" >/dev/null 2>&1; then ok=1; echo "   ✅ 下载成功"; break; fi
  fi
  echo "   ✗ 失败，换下一个镜像"
done
if [ "$ok" != "1" ]; then
  echo "⚠️ 所有镜像都下载失败。请稍后重试，或在服务器上执行："
  echo "   curl -fL --retry 3 -o $PKG https://ghfast.top/https://github.com/$GH_PATH"
  exit 1
fi

rm -rf pharos-ocean-main
tar xzf "$PKG"
cd pharos-ocean-main
# 还原数据与素材
if [ -d "$BACKUP/data" ]; then
  cp -a "$BACKUP/data" ./data
  chmod -R u+w ./data 2>/dev/null || true
  chown -R root:root ./data 2>/dev/null || true
  echo "已恢复历史数据 data/（并修复写权限）"
fi
if [ -d "$BACKUP/assets" ] && [ -d ./frontend/m/assets ]; then cp -a "$BACKUP/assets/." ./frontend/m/assets/; fi
[ -f .env ] || cp .env.example .env

echo "==> [3/5] 安装依赖(清华镜像源,约 1-2 分钟)"
python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple
.venv/bin/pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r backend/requirements.txt

echo "==> [4/5] 注册开机自启服务并启动"
# 8088 端口转发到 8320(防火墙放行 8088 即可访问)
cat > /etc/systemd/system/pharos.service <<'UNIT'
[Unit]
Description=PHAROS Ocean (出海工作台)
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/pharos-ocean-main/backend
ExecStartPre=/bin/bash -c 'iptables -t nat -D PREROUTING -p tcp --dport 8088 -j REDIRECT --to-ports 8320 2>/dev/null; iptables -t nat -A PREROUTING -p tcp --dport 8088 -j REDIRECT --to-ports 8320 || true'
ExecStart=/opt/pharos-ocean-main/.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8320
Restart=always
RestartSec=3
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now pharos

echo ""
echo "==> 等待服务就绪…"
ready=0
for i in $(seq 1 40); do
  if curl -sf http://127.0.0.1:8320/api/health >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 3
done

echo ""
if [ "$ready" = "1" ]; then
  echo "✅ 部署成功!"
  IP=$(curl -s --max-time 3 http://metadata.tencentyun.com/latest/meta-data/public-ipv4 2>/dev/null || true)
  if [ -n "$IP" ]; then
    echo "🌐 系统地址(发给任何人即可用): http://$IP:8088"
  else
    echo "🌐 系统地址: http://<这台服务器的公网IP>:8088"
  fi
  echo ""
  echo "提示:如果浏览器打不开,请到服务器控制台的「防火墙」页面,"
  echo "      放行 TCP 端口 8088(应用类型选自定义),再访问即可。"
  echo "      打开页面后点右上角 ⚙ 粘贴 API Key 即可使用。"
else
  echo "⚠️ 服务尚未就绪,请运行以下命令查看日志:"
  echo "    journalctl -u pharos -n 100 --no-pager"
fi
