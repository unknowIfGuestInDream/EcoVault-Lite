/**
 * @file Paginated response helper.
 *
 * Mirrors the Java `PageResponse<T>` (a slimmed-down Spring `Page`) using
 * zero-based page numbering.
 */

/**
 * @template T
 * @typedef {object} PageResponseBody
 * @property {T[]} content - Items on the current page.
 * @property {number} number - Zero-based page index.
 * @property {number} size - Requested page size.
 * @property {number} totalElements - Total number of matching items.
 * @property {number} totalPages - Total number of pages.
 * @property {boolean} first - Whether this is the first page.
 * @property {boolean} last - Whether this is the last page.
 */

/**
 * Build a page response body.
 *
 * @template T
 * @param {T[]} content - Items on the current page.
 * @param {number} page - Zero-based page index.
 * @param {number} size - Page size.
 * @param {number} totalElements - Total number of matching items.
 * @returns {PageResponseBody<T>} The page body.
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
