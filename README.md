# ⚓ PHAROS 出海工作台

**中小商家出海一站式系统**:保留 PHAROS 原版「海洋下潜」交互工作台,叠加上账号门槛、出海启动与平台对接,接入任意 OpenAI 兼容 API(DeepSeek / 智谱 / 通义 / Kimi 等)即可使用。

## 它是什么

打开系统是原版的金色海面入口 —— 向下滚动、潜入 48 米,自动进入交互工作台(8 位智能体 + 决策门 + 右侧团队面板,原版设计完全保留)。进入工作台时完成登录/注册(公司级产品的常规门槛),然后:

| 模块 | 说明 |
| --- | --- |
| 🧭 原版工作台 | 8 位专业智能体、决策门、团队与审批面板 —— 原版交互原样保留 |
| 🚀 出海启动 | 填 4 步资料(商家情况 → 产品 → 市场 → 确认),AI 生成专属出海方案:首选平台、平台适配对比、阶段任务、预算测算、资质清单、风险提示 |
| 🔗 平台对接 | 亚马逊 / TikTok Shop / Temu / SHEIN / Shopee / Lazada / 速卖通 / Shopify 8 大平台:记录对接进度、AI 生成结合你资料的定制入驻指南 |
| ⚙ AI 服务 | 应用内 ⚙ 与服务器配置双向同步:一处保存,全员可用,立即生效 |

## 快速开始(本机)

```bash
git clone https://github.com/dl0607-prog/pharos-ocean.git
cd pharos-ocean
bash start.sh
```

浏览器打开 <http://localhost:8320> → 海面入口滚动到底 → 注册账号 → 进入工作台。

AI 配置有两种方式(任选其一,自动互相同步):

1. **界面配置**:工作台右上角 ⚙ → 选服务商预设(DeepSeek / 智谱 / 通义 / Kimi / OpenAI / 硅基流动)→ 粘贴 API Key → 保存并测试连接;
2. **文件配置**:复制 `.env.example` 为 `.env`,填入 `LLM_API_KEY` 后重启。

## 服务器部署(腾讯云轻量 / CVM)

在【服务器网页终端】里粘贴(不要在 Mac/Windows 本机运行):

```bash
curl -fsSL https://raw.githubusercontent.com/dl0607-prog/pharos-ocean/main/deploy.sh -o /tmp/pharos.sh && bash /tmp/pharos.sh
```

脚本自动完成:装 Python 环境 → 下载代码 → 建虚拟环境装依赖 → 注册 `pharos` 开机自启服务(内部 8320 端口)→ 8088 端口转发。

完成后访问 `http://<服务器公网IP>:8088`。若打不开:控制台 → 防火墙 → 添加规则,放行 **TCP 8088**。

> 说明:与「软著工场」可部署在同一台服务器互不影响(软著工场用 80 端口,PHAROS 用 8088)。

## API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/register` / `/api/auth/login` / `/api/auth/logout` | 注册 / 登录 / 退出 |
| GET | `/api/auth/me` | 当前登录用户 |
| GET | `/api/health` | 健康检查 + AI 配置状态 |
| GET | `/api/agents` | 智能体列表 |
| GET/POST | `/api/settings` | 读取 / 保存 AI 配置(已登录用户可取回服务端 Key 下发浏览器) |
| POST | `/api/settings/test` | 测试 AI 连接 |
| GET/POST | `/api/conversations` | 对话列表 / 新建对话 |
| GET/DELETE | `/api/conversations/{id}` | 对话详情(含消息)/ 删除对话 |
| POST | `/api/conversations/{id}/send` | 发送消息(SSE 流式回复) |
| GET/PUT | `/api/launch/plan` | 出海计划读取 / 保存(向导资料) |
| POST | `/api/launch/generate` | AI 生成出海方案 |
| POST | `/api/launch/first-order` | 标记首次出单里程碑 |
| GET | `/api/launch/platforms` | 平台列表(含对接进度) |
| PUT | `/api/launch/platforms/{id}` | 保存对接进度 / 店铺链接 / 备注 |
| POST | `/api/launch/platforms/{id}/guide` | AI 生成该平台定制入驻指南 |

## 目录结构

```
pharos-ocean/
├── backend/            # FastAPI 后端
│   ├── requirements.txt
│   └── app/            # config / llm(SSRF校验+流式) / agents / platforms / database / auth / main
├── frontend/           # 原版工作台应用(index.html) + 扩展层(pharos-ext.css/js)
├── data/               # 运行时生成:SQLite + settings.json(不入库)
├── start.sh            # 本机一键启动
├── deploy.sh           # 服务器一键部署
└── legacy/             # 历史单文件版本存档
```

## 安全说明

- AI 接口地址仅允许 http/https,保存与每次调用前都校验,拒绝本机 / 环回 / 私网 / 保留地址(防 SSRF)
- 密码 PBKDF2 加盐哈希存储;登录态 30 天;对话与方案数据按账号隔离
- API Key 只保存在服务器 `data/settings.json`,前端仅登录后可见(用于下发浏览器端应用),不对外公开

## License

MIT
