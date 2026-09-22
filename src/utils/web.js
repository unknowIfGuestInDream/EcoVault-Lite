/**
 * @file HTTP request helpers.
 *
 * Mirrors the Java `WebUtil` client-IP resolution used by the operation-log
 * aspect.
 */

/**
 * Whether a header value is usable (non-blank and not the literal "unknown").
 *
 * @param {unknown} value - Header value.
 * @returns {boolean} True when the value can be used as an IP.
 */
function isUsable(value) {
  return typeof value === 'string' && value.trim() !== '' && value.toLowerCase() !== 'unknown';
}

/**
 * Resolve the originating client IP for a request.
 *
 * Resolution order mirrors Java `WebUtil.getClientIp`:
 * 1. `X-Forwarded-For` (first entry before a comma), when usable.
 * 2. `X-Real-IP`, when usable.
 * 3. The socket remote address.
 *
 * @param {import('fastify').FastifyRequest} [request] - Incoming request.
 * @returns {string} The resolved client IP, or "unknown".
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
