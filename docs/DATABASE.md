# EcoVault Lite 数据库设计

EcoVault Lite 使用 SQLite 3 作为单机存储，表结构定义见 [`../src/db/schema.sql`](../src/db/schema.sql)，启动时自动建表（`CREATE TABLE IF NOT EXISTS`）。

## 设计约定

- **金额**：所有金额列均为整数，单位为「分」，避免二进制浮点误差；仅在接口序列化时换算为元。
- **时间戳**：以 `yyyy-MM-dd HH:mm:ss` 文本存储，保证范围查询按字典序正确排序。
- **布尔值**：以 `INTEGER`（`0` / `1`）存储。
- **参数绑定**：所有读写均使用参数绑定，杜绝 SQL 注入。
- **索引**：按用户、日期、类型、标签等高频查询维度建立索引。

## 表结构

### users（用户）

| 列           | 类型    | 说明                          |
| ------------ | ------- | ----------------------------- |
| `id`         | INTEGER | 主键，自增                    |
| `username`   | TEXT    | 用户名，唯一                  |
| `password`   | TEXT    | BCrypt 口令哈希               |
| `nickname`   | TEXT    | 昵称                          |
| `email`      | TEXT    | 邮箱                          |
| `role`       | TEXT    | 角色，`USER` / `ADMIN`        |
| `enabled`    | INTEGER | 是否启用（`1` 启用）          |
| `created_at` | TEXT    | 创建时间                      |
| `updated_at` | TEXT    | 更新时间                      |

索引：`idx_users_username`（唯一）。

### user_sessions（登录会话）

服务端 JWT `jti` 注册表，用于会话校验与设备数限制。

| 列               | 类型    | 说明                      |
| ---------------- | ------- | ------------------------- |
| `id`             | INTEGER | 主键，自增                |
| `user_id`        | INTEGER | 所属用户                  |
| `jti`            | TEXT    | JWT ID，唯一              |
| `device_info`    | TEXT    | 设备信息                  |
| `ip`             | TEXT    | 登录 IP                   |
| `active`         | INTEGER | 是否活跃（`1` 活跃）      |
| `created_at`     | TEXT    | 创建时间                  |
| `last_active_at` | TEXT    | 最近活跃时间              |

索引：`idx_sessions_jti`（唯一）、`idx_sessions_user`。

### password_entries（密码保险箱条目）

| 列               | 类型    | 说明                            |
| ---------------- | ------- | ------------------------------- |
| `id`             | INTEGER | 主键，自增                      |
| `user_id`        | INTEGER | 所属用户                        |
| `title`          | TEXT    | 标题                            |
| `account`        | TEXT    | 账号                            |
| `secret`         | TEXT    | 密钥，AES-256-GCM 密文          |
| `url`            | TEXT    | 关联地址                        |
| `notes`          | TEXT    | 备注                            |
| `category`       | TEXT    | 分类                            |
| `tags`           | TEXT    | 标签（加密存储）                |
| `strength_score` | INTEGER | 密码强度评分                    |
| `strength_level` | TEXT    | 强度等级（WEAK/MEDIUM/STRONG）  |
| `created_at`     | TEXT    | 创建时间                        |
| `updated_at`     | TEXT    | 更新时间                        |

索引：`idx_pwd_user`、`idx_pwd_category`。

### salary_records（工资记录）

每个用户每个年月唯一一条（`UNIQUE (user_id, year, month)`）；`month = 0` 表示当年的年终奖。金额列均为整数分。

发放项：`base_salary`（基本工资）、`performance_salary`（绩效工资）、`housing_allowance`（租房补助）、`meal_allowance`（伙食补助）、`transport_allowance`（交通补助）、`overtime_pay`（加班费）、`overtime_allowance`（加班补助）、`bonus`（奖金）。

缴费基数：`medical_base`（医疗基数）、`pension_unemployment_base`（养老/失业基数）、`housing_fund_base`（公积金基数）。

扣除项：`medical_deduction`（医疗）、`pension_deduction`（养老）、`unemployment_deduction`（失业）、`housing_fund_deduction`（公积金）、`income_tax`（所得税）。

税后附加项：`serious_illness_medical`（大病医疗）、`heating_allowance`（采暖补贴）。

派生字段（可存储覆盖值，否则按组成项计算）：`gross_pay`（应发工资）、`total_deduction`（扣除项合计）、`pre_tax_salary`（税前工资）、`after_tax_salary`（税后工资）、`net_pay`（实发金额）。

其余：`remark`（备注）、`created_at`、`updated_at`。

索引：`idx_salary_user`、`idx_salary_ym`。

### ledger_entries（收支记账）

| 列           | 类型    | 说明                     |
| ------------ | ------- | ------------------------ |
| `id`         | INTEGER | 主键，自增               |
| `user_id`    | INTEGER | 所属用户                 |
| `type`       | TEXT    | 类型（收入 / 支出）      |
| `amount`     | INTEGER | 金额（整数分）           |
| `entry_date` | TEXT    | 记账日期                 |
| `remark`     | TEXT    | 备注                     |
| `created_at` | TEXT    | 创建时间                 |
| `updated_at` | TEXT    | 更新时间                 |

索引：`idx_ledger_user`、`idx_ledger_date`、`idx_ledger_type`。

### ledger_entry_tags（记账标签）

记账条目与标签的多对多关联，随条目级联删除。

| 列         | 类型    | 说明                             |
| ---------- | ------- | -------------------------------- |
| `entry_id` | INTEGER | 记账条目，外键（级联删除）       |
| `tag`      | TEXT    | 标签                             |

主键：`(entry_id, tag)`；索引：`idx_ledger_tag`。

### operation_logs（操作日志）

| 列            | 类型    | 说明                    |
| ------------- | ------- | ----------------------- |
| `id`          | INTEGER | 主键，自增              |
| `user_id`     | INTEGER | 操作用户                |
| `username`    | TEXT    | 操作用户名              |
| `module`      | TEXT    | 模块                    |
| `operation`   | TEXT    | 操作                    |
| `method`      | TEXT    | HTTP 方法               |
| `params`      | TEXT    | 请求参数（脱敏后）      |
| `ip`          | TEXT    | 客户端 IP               |
| `status`      | TEXT    | 结果状态                |
| `error_msg`   | TEXT    | 错误信息                |
| `duration_ms` | INTEGER | 耗时（毫秒）            |
| `created_at`  | TEXT    | 创建时间                |

索引：`idx_log_user`、`idx_log_module`、`idx_log_created`。

### role_permissions（角色页面权限）

角色到可访问页面的映射，构成 RBAC 权限矩阵。

| 列         | 类型    | 说明                    |
| ---------- | ------- | ----------------------- |
| `id`       | INTEGER | 主键，自增              |
| `role`     | TEXT    | 角色                    |
| `page_key` | TEXT    | 页面标识                |

唯一约束：`(role, page_key)`。
