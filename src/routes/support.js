import { success } from '../common/apiResponse.js';

/**
 * @file 路由通用辅助工具。
 *
 * 提供请求参数解析、脱敏用户视图与 CSV 下载响应等共享能力。
 */

/**
 * 将输入解析为整数，无法解析时返回 undefined。
 *
 * @param {unknown} value - 输入值。
 * @returns {number | undefined} 整数或 undefined。
 */
export function toInt(value) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

/**
 * 解析路由路径参数 `:id`。
 *
 * @param {object} request - 请求对象。
 * @returns {number | undefined} 解析后的 id。
 */
export function parseId(request) {
  return toInt(request.params?.id);
}

/**
 * 生成用户的对外安全视图（剔除口令等敏感字段）。
 *
 * @param {object | null} user - 用户实体。
 * @returns {object | null} 脱敏后的用户视图。
 */
export function sanitizeUser(user) {
  if (!user) {
    return null;
  }
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    email: user.email,
    role: user.role,
    enabled: user.enabled,
    createdAt: user.createdAt,
  };
}

/**
 * 以附件形式发送 CSV 文本（带下载文件名）。
 *
 * @param {object} reply - Fastify 响应对象。
 * @param {string} filename - 下载文件名。
 * @param {string} csv - CSV 文本内容。
 * @returns {object} Fastify 响应。
 */
export function sendCsv(reply, filename, csv) {
  reply.header('Content-Type', 'text/csv; charset=utf-8');
  reply.header('Content-Disposition', `attachment; filename="${filename}"`);
  return reply.send(csv);
}

/**
 * 构建标准成功响应封装。
 *
 * @template T
 * @param {T} [data] - 载荷。
 * @param {string} [message] - 可选消息。
 * @returns {object} 统一成功响应。
 */
export function ok(data, message) {
  return message === undefined ? success(data) : success(data, message);
}

export default { toInt, parseId, sanitizeUser, sendCsv, ok };
