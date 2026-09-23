/**
 * @file HTTP 请求辅助工具。
 *
 * 对齐操作日志切面使用的 Java `WebUtil` 客户端 IP 解析
 * 逻辑。
 */

/**
 * 判断 header 值是否可用（非空白且不是字面量 "unknown"）。
 *
 * @param {unknown} value - header 值。
 * @returns {boolean} 值可作为 IP 使用时返回 true。
 */
function isUsable(value) {
  return typeof value === 'string' && value.trim() !== '' && value.toLowerCase() !== 'unknown';
}

/**
 * 解析请求的原始客户端 IP。
 *
 * 解析顺序对齐 Java `WebUtil.getClientIp`：
 * 1. `X-Forwarded-For`（逗号前的第一个条目），可用时使用。
 * 2. `X-Real-IP`，可用时使用。
 * 3. socket 远端地址。
 *
 * @param {object} [request] - 传入请求。
 * @returns {string} 解析出的客户端 IP，或 "unknown"。
 */
export function getClientIp(request) {
  if (!request) {
    return 'unknown';
  }
  const headers = request.headers ?? {};
  const forwarded = headers['x-forwarded-for'];
  if (isUsable(forwarded)) {
    const first = String(forwarded).split(',')[0].trim();
    if (first !== '') {
      return first;
    }
  }
  const realIp = headers['x-real-ip'];
  if (isUsable(realIp)) {
    return String(realIp).trim();
  }
  const remote = request.socket?.remoteAddress ?? request.ip;
  return remote || 'unknown';
}

export default { getClientIp };
