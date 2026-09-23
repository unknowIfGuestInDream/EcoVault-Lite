# EcoVault Lite（生态保险箱·轻量版）

EcoVault Lite 是个人数据安全存储与智能管理平台，基于 **Node.js 24 + SQLite3**
打造，面向单机部署场景提供低资源占用、易运维的安全数据管理能力。
项目采用分层架构与本地数据库，兼顾敏感数据保护、权限控制、操作审计与日常使用体验。

> 架构设计、分层职责与核心安全策略详见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 技术栈

| 领域 | 选型 |
| --- | --- |
| 运行时 | Node.js 24（ESM） |
| Web 框架 | [Fastify 5](https://fastify.dev/) |
| 数据库 | SQLite 3（[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)，同步驱动） |
| 认证 | JWT（jsonwebtoken）+ BCrypt（bcryptjs），支持单设备登录 |
| 加密 | AES-256-GCM（`node:crypto`） |
| 视图 | EJS 服务端渲染 |
| 测试 / 覆盖率 | `node:test` + [c8](https://github.com/bcoe/c8) |
| 代码规范 | ESLint + Prettier |
| API 文档 | JSDoc |
| 持续集成 | GitHub Actions + Jenkins（Node.js 24） |

## 功能概览

- **用户与权限**：RBAC（`USER` / `ADMIN`）、JWT 认证、单设备登录、管理员后台创建用户（不开放自助注册）。
- **密码保险箱**：条目敏感字段 AES-256-GCM 加密存储、列表脱敏展示、按标签检索、密码强度评估。
- **财务管理**：工资台账（派生字段计算、26 列 CSV 导入导出）、收支记账（按标签与周期统计）。
- **操作日志**：统一钩子自动记录关键操作并对敏感字段脱敏，支持查询与 CSV 导出。
- **管理后台**：用户管理、角色→页面权限矩阵维护、系统运行信息查询。

## 目录结构

```text
src/
  config/         # 配置与环境变量加载
  domain/         # 领域模型、枚举与派生计算
  db/             # SQLite 连接与表结构
  repositories/   # 数据访问层（参数绑定查询）
  services/       # 业务服务层
  security/       # JWT、加密、口令哈希与强度评估
  common/         # 统一响应、错误类型与请求校验
  utils/          # 金额、日期、请求等通用工具
  plugins/        # Fastify 钩子（认证、鉴权、CSRF、操作日志）
  context.js      # 依赖注入装配
```

## 环境要求

- Node.js **24** 及以上
- npm 10 及以上

## 快速开始

```bash
# 安装依赖
npm ci

# 复制并按需修改环境变量
cp .env.example .env

# 启动服务（默认监听 0.0.0.0:8100）
npm start

# 开发模式（文件变更自动重启）
npm run dev
```

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm start` | 启动服务 |
| `npm run dev` | 开发模式（`--watch`） |
| `npm test` | 运行 `node:test` 测试 |
| `npm run test:coverage` | 运行测试并按 `.c8rc.json` 阈值校验覆盖率 |
| `npm run lint` / `npm run lint:fix` | ESLint 检查 / 自动修复 |
| `npm run format` / `npm run format:check` | Prettier 格式化 / 校验 |
| `npm run docs` | 生成 JSDoc HTML 文档到 `docs-gen/` |

## 配置项

所有配置通过环境变量提供，参见 [`.env.example`](.env.example)。关键项：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `ECOVAULT_PORT` | `8100` | 监听端口 |
| `ECOVAULT_HOST` | `0.0.0.0` | 监听地址 |
| `ECOVAULT_DB_PATH` | `data/ecovault.db` | SQLite 数据库文件路径 |
| `ECOVAULT_JWT_SECRET` | （占位符） | JWT 签名密钥，生产环境必须修改 |
| `ECOVAULT_JWT_EXPIRATION_MS` | `7200000` | 令牌有效期（毫秒） |
| `ECOVAULT_MAX_DEVICES` | `1` | 单账号最大在线设备数 |
| `ECOVAULT_CRYPTO_SECRET` | （占位符） | AES 加密密钥，生产环境必须修改 |
| `ECOVAULT_ADMIN_USERNAME` | `admin` | 初始管理员用户名 |
| `ECOVAULT_ADMIN_PASSWORD` | `Admin@123` | 初始管理员密码，请尽快修改 |

## 许可证

本项目基于 [MIT License](LICENSE) 开源。
