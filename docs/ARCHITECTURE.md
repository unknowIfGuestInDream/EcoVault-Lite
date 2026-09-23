# EcoVault Lite 架构设计

本文档描述 EcoVault Lite 的整体架构、分层职责、请求处理流程、安全模型与运维方案，供开发与维护人员参考。数据库结构见 [`DATABASE.md`](DATABASE.md)，HTTP 接口见 [`API.md`](API.md)。

## 1. 概述

EcoVault Lite（生态保险箱·轻量版）是一个个人数据安全存储与智能管理平台，采用 **Node.js 24 + SQLite3** 的轻量化单机架构，目标是在低内存占用与简单部署的前提下，提供完整的个人数据管理能力：

- 用户与 RBAC 权限（`USER` / `ADMIN`）
- 密码保险箱（敏感字段加密存储、脱敏展示、密码强度评估）
- 工资台账（派生字段计算、CSV 导入导出、统计）
- 收支记账（标签与周期统计、CSV 导出）
- 操作日志（统一钩子记录、敏感字段脱敏）
- 后台管理（管理员创建用户、角色→页面权限矩阵）

## 2. 技术栈

| 领域          | 选型                                        |
| ------------- | ------------------------------------------- |
| 运行时        | Node.js 24（ESM）                           |
| Web 框架      | Fastify 5                                   |
| 数据库        | SQLite 3（better-sqlite3，同步驱动）        |
| 认证          | JWT（jsonwebtoken）                         |
| 口令哈希      | BCrypt（bcryptjs）                          |
| 敏感字段加密  | AES-256-GCM（`node:crypto`）                |
| 视图          | EJS 服务端渲染                              |
| 测试 / 覆盖率 | `node:test` + c8                            |
| 代码规范      | ESLint + Prettier                           |
| API 文档      | JSDoc                                       |
| 持续集成      | GitHub Actions + Jenkins（工具标签 node24） |

## 3. 分层架构

系统按自顶向下的单向依赖分层，上层依赖下层，下层不感知上层：

```text
config  →  domain  →  repositories  →  services  →  plugins / routes
```

| 层级        | 目录                        | 职责                                                            |
| ----------- | --------------------------- | --------------------------------------------------------------- |
| 配置层      | `src/config`                | 加载环境变量并归一化为强类型配置对象                            |
| 领域层      | `src/domain`                | 领域枚举（角色、账目类型、菜单页）与纯函数派生计算（工资）      |
| 通用层      | `src/common`                | 统一响应封装、错误类型、请求参数校验                            |
| 安全层      | `src/security`              | JWT 签发/校验、AES-GCM 加解密、口令哈希、密码强度评估           |
| 工具层      | `src/utils`                 | 金额（整数分）运算、日期时间格式化、客户端 IP 解析              |
| 数据访问层  | `src/repositories`          | 基于参数绑定的 SQL 读写，封装排序、分页与过滤语义               |
| 服务层      | `src/services`              | 业务编排、加解密与脱敏、CSV 导入导出与统计                      |
| 插件/路由层 | `src/plugins`、`src/routes` | Fastify 钩子（认证、鉴权、CSRF、操作日志、错误处理）与 HTTP 路由 |

### 目录结构

```text
src/
  config/         # 配置与环境变量加载
  domain/         # 领域枚举与派生计算
  db/             # SQLite 连接与表结构（schema.sql）
  repositories/   # 数据访问层（参数绑定查询）
  services/       # 业务服务层
  security/       # JWT、加密、口令哈希与强度评估
  common/         # 统一响应、错误类型与请求校验
  utils/          # 金额、日期、请求等通用工具
  plugins/        # Fastify 钩子（认证、鉴权、CSRF、操作日志、错误处理）
  routes/         # HTTP 路由模块
  views/          # EJS 模板
  bootstrap/      # 启动初始化（管理员与默认权限种子）
  context.js      # 依赖注入装配
  app.js          # Fastify 应用装配
  server.js       # 进程入口
```

## 4. 依赖注入（`createContext`）

所有仓储与服务通过 `createContext(db)` 从单个数据库句柄集中装配，形成对象图：

```js
const context = createContext(db);
context.repositories.userRepository;
context.services.authService;
```

- **生产环境**：进程入口创建共享的单例数据库句柄，装配一次上下文。
- **测试环境**：围绕内存数据库（`:memory:`）装配独立上下文，实现用例间完全隔离，无需任何外部依赖或模拟框架。

这种方式避免了全局单例耦合，使每一层都可独立、可替换、可测试。

## 5. 请求处理流程

Fastify 通过统一钩子实现横切关注点，业务路由只关注具体逻辑：

```text
请求
 └─ onRequest：认证（解析 JWT → 校验会话 → 加载用户，绝不拒绝）
 └─ onRequest：授权（按 URL 模式判定 public / admin / 认证）
 └─ preHandler：CSRF 双提交校验（非安全方法）
 └─ 路由处理器：调用服务层，返回统一响应
 └─ onResponse：操作日志（记录关键操作并脱敏敏感字段）
 └─ setErrorHandler：统一错误处理（错误类型 → HTTP 状态与响应体）
```

所有 JSON 接口统一返回如下结构：

```json
{ "code": 0, "message": "success", "data": {} }
```

## 6. 安全模型

- **认证**：登录成功后签发 JWT，并在服务端 `user_sessions` 表登记 `jti`。每次请求校验 token 与活跃会话，双向确认后方视为已认证。
- **会话与设备数**：默认单设备登录；可通过 `ECOVAULT_MAX_DEVICES` 放开为多设备，超过上限时淘汰最早的活跃会话。
- **授权（RBAC）**：角色分 `USER` 与 `ADMIN`，按 URL 模式集中鉴权。管理端点（`/admin/**`、`/api/admin/**`、`/api/logs/**`）仅 `ADMIN` 可访问；普通用户仅能由管理员在后台创建，不提供外部自助注册。
- **口令**：用户密码使用 BCrypt 哈希存储，不可逆。
- **敏感字段加密**：密码保险箱条目的密钥等敏感字段使用 AES-256-GCM 加密存储；列表默认脱敏展示，仅按需解密。
- **CSRF**：对非安全方法采用双提交校验（`XSRF-TOKEN` Cookie + `X-XSRF-TOKEN` 请求头）。
- **密码强度**：录入时评估密码强度并给出等级（WEAK / MEDIUM / STRONG）。
- **日志脱敏**：操作日志、异常信息与导出文件均不落库或展示明文敏感信息。

## 7. 数据与金额处理

- **金额**：一律以「分」为单位的整数存储，避免二进制浮点误差，仅在序列化边界转换为元。
- **时间戳**：以 `yyyy-MM-dd HH:mm:ss` 文本存储，保证范围查询按字典序正确排序。
- **查询**：全部使用参数绑定，杜绝 SQL 注入；按查询场景建立索引（用户、日期、类型、标签等）。

数据表定义详见 [`DATABASE.md`](DATABASE.md)。

## 8. 配置

配置集中于 `src/config`，全部来源于环境变量并提供开发友好的默认值。关键项：

| 变量                         | 默认值             | 说明                  |
| ---------------------------- | ------------------ | --------------------- |
| `ECOVAULT_PORT`              | `8100`             | 监听端口              |
| `ECOVAULT_HOST`              | `0.0.0.0`          | 监听地址              |
| `ECOVAULT_DB_PATH`           | `data/ecovault.db` | SQLite 数据库文件路径 |
| `ECOVAULT_JWT_SECRET`        | （占位符）         | JWT 签名密钥          |
| `ECOVAULT_JWT_EXPIRATION_MS` | `7200000`          | 令牌有效期（毫秒）    |
| `ECOVAULT_MAX_DEVICES`       | `1`                | 单账号最大在线设备数  |
| `ECOVAULT_CRYPTO_SECRET`     | （占位符）         | AES 加密密钥          |
| `ECOVAULT_ADMIN_USERNAME`    | `admin`            | 初始管理员用户名      |
| `ECOVAULT_ADMIN_PASSWORD`    | （占位符）         | 初始管理员密码        |

> 生产环境务必替换所有密钥与初始口令；示例配置仅使用占位符。

## 9. 测试与质量

- 使用 `node:test` 编写单元与集成测试，通过内存数据库对服务层与数据访问层做端到端验证。
- 使用 c8 统计覆盖率，阈值在 `.c8rc.json` 中定义，通过 `npm run test:coverage` 校验，CI 强制门禁。
- 覆盖率与测试报告在持续集成中生成并归档为构建产物。
- API 文档由 JSDoc 生成（`npm run docs`）。

## 10. 部署与运维

- **持续集成**：GitHub Actions 执行安装依赖、静态检查、测试、覆盖率与文档生成；`Jenkinsfile` 使用 Node.js 24（工具标签 `node24`），流水线包含安装、静态检查、测试、覆盖率、打包归档与主分支部署。
- **部署脚本**：`deploy/` 下脚本包含停止旧服务、备份旧版本、部署新制品、启动服务与健康检查。
- **健康检查**：通过 `/health` 端点暴露运行状态。
