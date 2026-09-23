/**
 * @file 分页响应辅助工具。
 *
 * 对齐 Java `PageResponse<T>`（精简版 Spring `Page`），使用
 * 从零开始的页码编号。
 */

/**
 * @template T
 * @typedef {object} PageResponseBody
 * @property {T[]} content - 当前页的条目。
 * @property {number} number - 从零开始的页索引。
 * @property {number} size - 请求的分页大小。
 * @property {number} totalElements - 匹配条目的总数。
 * @property {number} totalPages - 总页数。
 * @property {boolean} first - 是否为第一页。
 * @property {boolean} last - 是否为最后一页。
 */

/**
 * 构建分页响应体。
 *
 * @template T
 * @param {T[]} content - 当前页的条目。
 * @param {number} page - 从零开始的页索引。
 * @param {number} size - 分页大小。
 * @param {number} totalElements - 匹配条目的总数。
 * @returns {PageResponseBody<T>} 分页响应体。
 */
export function pageResponse(content, page, size, totalElements) {
  const safeSize = size > 0 ? size : 1;
  const totalPages = size > 0 ? Math.ceil(totalElements / safeSize) : 0;
  return {
    content,
    number: page,
    size,
    totalElements,
    totalPages,
    first: page <= 0,
    last: page >= totalPages - 1,
  };
}

export default pageResponse;
