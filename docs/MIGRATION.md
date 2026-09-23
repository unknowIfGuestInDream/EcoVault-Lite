# EcoVault Lite 迁移说明

本文档记录 EcoVault 由 **Java / Spring Boot** 迁移为 **Node.js 24 + SQLite3**
（项目代号 **EcoVault Lite**）的背景、选型、架构与关键决策。原项目地址：
<https://github.com/unknowIfGuestInDream/EcoVault>。

## 1. 背景与目标

原 `EcoVault` 基于 Java 架构运行，JVM 常驻内存较高，已对同机的 Jenkins 编译任务造成
资源争用。本次迁移在**完整保留现有功能**的前提下，改用轻量化的 Node.js 24 + SQLite3
单机架构，目标是：

- 显著降低服务常驻内存占用；
- 减轻 Jenkins 构建期间的资源争用；
- 简化部署、运行与维护成本；
- 通过完善测试与覆盖率输出提升可验证性。

## 2. 运行时与框架选型

| 维度       | 选型                     | 说明                                                       |
| ---------- | ------------------------ | ---------------------------------------------------------- |
| 运行时     | Node.js 24               | 迁移硬性要求                                               |
| 数据库     | SQLite3（better-sqlite3）| 单机轻量，同步 API 简化事务与查询语义迁移                  |
| Web 框架   | **Fastify 5**            | 主流、开源、活跃维护，低开销，插件/钩子机制契合横切关注点  |
| 认证       | jsonwebtoken（JWT）      | 复刻原有 JWT 认证与会话校验                                |
| 口令哈希   | bcryptjs                 | 对齐原 BCrypt                                              |
| 敏感字段   | node:crypto（AES-256-GCM）| 对齐原密码保险箱加密                                        |
| 测试       | node:test + c8           | 内置测试运行器 + 覆盖率                                     |
| 规范       | ESLint + Prettier        | 统一静态检查与格式化                                       |
| 文档       | JSDoc                    | 见第 5 节文档工具决策                                       |

### 为什么选择 Fastify（对比 Express / NestJS）

- **Fastify**：内置 schema 校验、hooks/plugins 生态成熟，性能与内存开销优于 Express，
  轻量程度优于 NestJS，最契合「单机、低内存」的目标，且认证 + 操作日志等横切逻辑可通过
  统一钩子实现。**最终采用。**
- **Express**：生态庞大但核心过于精简，横切能力需自行拼装，长期维护成本更高。
- **NestJS**：工程化与模块化能力强，但依赖注入容器与装饰器体系较重，对本项目的轻量化
  目标属于过度设计。

## 3. 架构分层

```text
config  →  domain  →  repositories  →  services  →  plugins/routes
```

- 依赖通过 `createContext(db)` 注入，测试可注入内存数据库（`:memory:`）。
- 金额一律以「分」为单位的整数存储，避免浮点误差。
- 数据访问层复刻原 Java 的查询与排序语义。

## 4. 功能对照（完整迁移）

| 模块         | 能力                                                             |
| ------------ | ---------------------------------------------------------------- |
| 用户与 RBAC  | 登录、JWT、单/多设备会话限制，`USER` / `ADMIN` 角色              |
| 密码保险箱   | AES-GCM 加解密、列表脱敏展示                                      |
| 工资管理     | 派生字段计算、26 列 CSV 导入/导出、统计                          |
| 账本         | 标签/周期统计                                                    |
| 操作日志     | 统一钩子记录关键操作并对敏感字段脱敏                             |
| 后台管理     | 管理员创建/管理用户（不提供外部自助注册）                        |
| 权限矩阵     | 角色 → 页面权限                                                   |

## 5. 文档工具决策：Doxygen → JSDoc

**结论：不保留 Doxygen，改用 JSDoc。**

- **原因**：Doxygen 在 Node.js 生态中并非自然选择，对 ESM/JavaScript 的支持与工程集成度
  低，维护价值有限。
- **替代方案**：采用 **JSDoc**（`npm run docs` 生成 HTML，产物目录 `docs-gen/`）。全部
  模块均以 JSDoc 注释，必要时也可切换到 TypeDoc。
- 对应的 CI 工作流由原 `doxygen.yml` 替换为 `jsdoc.yml`，并将生成文档作为构建产物上传。

## 6. 工程链路

- **Jenkinsfile**：构建环境切换为 Node.js 24（工具标签 `node24`），流水线包含安装依赖、
  静态检查、测试、覆盖率、打包归档与主分支部署。
- **GitHub 工作流**：`ci.yml`（Node.js 24 安装依赖 + ESLint + Prettier + node:test + c8
  覆盖率，覆盖率作为产物上传）、`jsdoc.yml`（生成并上传 JSDoc 文档）、`label.yml`（PR 打标）。
- **覆盖率**：阈值在 `.c8rc.json` 中定义，本地通过 `npm run test:coverage` 校验；CI 以
  报告模式采集覆盖率并归档为产物。

## 7. 资源占用预期

相比 JVM 常驻进程，Node.js 24 + SQLite3 单机部署的常驻内存显著更低，可减轻对同机 Jenkins
构建的资源争用。迁移完成后将补充迁移前后内存/CPU/启动耗时的实测对比。
