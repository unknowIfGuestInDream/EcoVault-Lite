# EcoVault Lite AI 协作指令

你正在协助开发 EcoVault Lite（生态保险箱·轻量版），这是一个个人数据安全存储与智能管理平台，基于 **Node.js 24 + SQLite3** 构建，目标是实现低内存占用的轻量化单机版本。所有生成内容必须遵循以下规则。

## 基础信息

- npm 包名：`ecovault-lite`。
- 应用入口：`src/server.js`。
- 技术栈：Node.js 24、Fastify 5、better-sqlite3（SQLite 3）、EJS、node:test、c8、ESLint、Prettier、JSDoc、Jenkins。
- 前端图表可使用 Chart.js 或 ECharts。
- UI 风格应现代、响应式，支持玻璃拟态、渐变、暗色/亮色主题。

## 语言与编码

- **所有注释、文档、提交信息、PR 说明与面向用户的说明必须使用中文。**
- **与用户的 agent 会话（回复）也必须使用中文。**
- JSDoc 注释中的标签（如 `@param`、`@returns`）与类型、标识符保持原样，仅描述文字使用中文。
- 文件编码统一为 UTF-8。
- 代码遵循仓库既有的 ESLint + Prettier 规范。

## 架构与功能要求

- 采用分层结构：`config → domain → repositories → services → plugins/routes`，依赖通过 `createContext(db)` 注入，便于测试注入内存数据库。
- 使用 RBAC 权限模型，角色包括 `USER` 与 `ADMIN`。
- JWT 用于认证，并支持单设备登录或通过 `ECOVAULT_MAX_DEVICES` 配置设备数量。
- 用户密码必须使用 BCrypt（bcryptjs）哈希。
- 密码条目敏感字段必须使用 AES-256-GCM（node:crypto）加密。
- 使用统一的 Fastify 钩子自动记录关键操作日志，并对敏感字段脱敏。
- API 设计必须符合 RESTful 规范，统一返回 `{ code, message, data }` 结构。
- 金额一律以「分」为单位的整数存储，避免浮点误差。
- 数据库查询必须使用参数绑定，并根据查询场景优化索引。
- 健康检查与运维端点按部署需要最小暴露，管理端点（`/admin/**`、`/api/admin/**`、`/api/logs/**`）限制为 ADMIN 访问。
- 不提供外部自助注册，普通用户仅能由管理员在后台创建。

## 测试要求

- 新增或修改业务逻辑必须补充完整测试。
- 使用 `node:test` 编写测试，使用 c8 生成覆盖率报告。
- 覆盖率阈值在 `.c8rc.json` 中定义，可通过 `npm run test:coverage` 校验。
- 安全、加密、权限、单设备登录、CSV 导入导出与统计逻辑必须覆盖边界场景。

## 部署与运维要求

- 保持 `Jenkinsfile` 与部署脚本可用，Jenkins 使用 Node.js 24（工具标签 `node24`）。
- Jenkins 流水线应包含安装依赖、静态检查、测试、覆盖率、打包归档与主分支部署。
- 部署脚本必须包含停止旧服务、备份旧版本、部署新制品、启动服务与健康检查。
- 健康检查使用 `/health` 端点。

## 文档与安全规则

- 每次功能、接口、数据库、安全策略或部署流程变更都要同步更新 `docs` 文档。
- 使用 JSDoc 维护 API 文档（`npm run docs`）。
- 检查代码不要包含私密信息，包括真实密钥、Token、密码、数据库文件、证书与生产配置。
- 日志、异常、导出文件与页面展示不得泄露敏感信息。
- 生成示例配置时只能使用占位符。

## 前端资源与格式化约束

- 前端 JS/CSS 按功能点拆分到不同文件，避免把新增功能持续堆叠进单一公共文件；新增隐私模式、统计、页面交互等功能时，优先创建对应独立资源文件并在模板中按需引入。
- 每次修改代码后，提交前都必须执行 `npm run format` 与 `npm run lint`，确保通过 CI 中的 Prettier 与 ESLint 检查。
