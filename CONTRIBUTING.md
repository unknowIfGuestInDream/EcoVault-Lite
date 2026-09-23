# EcoVault Lite 贡献指南

感谢你参与 EcoVault Lite（生态保险箱轻量版）建设。本项目由原 Java / Spring Boot 版
[EcoVault](https://github.com/unknowIfGuestInDream/EcoVault) 迁移而来，现基于
**Node.js 24 + SQLite3** 构建。提交贡献前，请先阅读 [README.md](README.md) 与
[.github/copilot-instructions.md](.github/copilot-instructions.md)。

## 开发准备

- 安装 Node.js 24（`node -v` 应为 `v24.x`）。
- 使用项目自带的 npm（`npm -v`）。
- 确认本地使用 UTF-8 编码。

## 安装与运行

```bash
npm ci        # 按 package-lock.json 精确安装依赖
npm start     # 启动服务
npm run dev   # 以 watch 模式启动（本地开发）
```

## 构建与测试

```bash
npm run lint          # ESLint 静态检查
npm run format:check  # Prettier 格式校验
npm test              # 运行 node:test 单元/集成测试
npm run test:coverage # 运行测试并统计覆盖率（读取 .c8rc.json 的阈值门禁）
```

覆盖率报告位置：

```text
coverage/index.html
```

## 分支规范

分支名必须以用户名开头：

```text
<用户名>/<类型>/<简短主题>
```

示例：

```text
unknowIfGuestInDream/feat/password-tags
```

## 提交规范

提交信息必须使用中文并遵循格式：

```text
<类型>: <中文简短说明>
```

示例：

```text
fix: 修复单设备登录会话失效问题
```

## Pull Request 要求

- 已更新相关文档（`README.md`、`docs/`）。
- 已添加或更新必要的测试（`node:test`）。
- 已通过本地 `npm run lint`、`npm run format:check` 与 `npm test`。
- 未包含密钥、Token、真实密码、数据库文件或生产配置。
- 涉及安全、数据库、部署或 API 的变更已说明影响范围。

## 文档与测试

每次功能、接口、数据库、安全策略或部署流程变更，都必须同步更新文档与注释（本项目
统一使用**中文注释**）。新增业务逻辑应补充 `node:test` 测试，核心安全逻辑应覆盖正常、
异常与边界场景。API 文档由 JSDoc 生成（`npm run docs`）。

## 安全提醒

禁止提交真实敏感信息。示例配置必须使用占位符。发现安全漏洞时，请通过 GitHub 安全公告
私密反馈渠道报告。
