import { BusinessError } from '../common/errors.js';
import { LedgerType } from '../domain/ledgerType.js';
import { fromCents, formatCents } from '../utils/money.js';

/**
 * @file Ledger (income/expense) service.
 *
 * Reproduces the Java `LedgerServiceImpl`: CRUD, filtered queries, aggregate
 * statistics (totals, per-tag breakdown preserving first-seen order, monthly
 * trend sorted ascending) and BOM-prefixed CSV export.
 */

/** The bucket label used for entries that carry no tags. */
const UNCATEGORISED = '未分类';

/**
 * Parse an optional ledger type string.
 *
 * @param {string | null | undefined} type - Raw type.
 * @returns {string | null} A valid {@link LedgerType} or null when blank.
 * @throws {BusinessError} When the value is non-blank but invalid.
 */
function parseType(type) {
  if (type === null || type === undefined || String(type).trim() === '') {
    return null;
  }
  const normalized = String(type).trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(LedgerType, normalized)) {
    throw new BusinessError('收支类型不合法');
  }
  return LedgerType[normalized];
}

/**
 * Parse a required ledger type string.
 *
 * @param {string | null | undefined} type - Raw type.
 * @returns {string} A valid {@link LedgerType}.
 * @throws {BusinessError} When the value is blank or invalid.
 */
function parseRequiredType(type) {
  const parsed = parseType(type);
  if (parsed === null) {
    throw new BusinessError('收支类型不合法');
  }
  return parsed;
}

/**
 * Normalise a tag list: trim, drop blanks, de-duplicate preserving order.
 *
 * @param {string[] | null | undefined} tags - Raw tags.
 * @returns {string[]} Normalised tags.
 */
function normalizeTags(tags) {
  const result = [];
  const seen = new Set();
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      if (tag !== null && tag !== undefined && String(tag).trim() !== '') {
        const trimmed = String(tag).trim();
        if (!seen.has(trimmed)) {
          seen.add(trimmed);
          result.push(trimmed);
        }
      }
    }
  }
  return result;
}

/**
 * Escape a value for CSV output.
 *
 * @param {string | null | undefined} value - Raw value.
 * @returns {string} Escaped value.
 */
function escapeCsv(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const escaped = String(value).replace(/"/g, '""');
  if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
    return `"${escaped}"`;
  }
  return escaped;
}

/**
 * Ledger service.
 */
export class LedgerService {
  /**
   * @param {object} deps - Dependencies.
   * @param {import('../repositories/ledgerEntryRepository.js').LedgerEntryRepository} deps.repository - Ledger repo.
   */
  constructor({ repository }) {
    this.repository = repository;
  }

  /**
   * Create a ledger entry.
   *
   * @param {number} userId - Owner id.
   * @param {object} request - Ledger request.
   * @returns {object} Ledger response.
   */
  create(userId, request) {
    const entry = this.repository.insert({ userId, ...this.#applyRequest(request) });
    return this.#toResponse(entry);
  }

  /**
   * Update a ledger entry.
   *
   * @param {number} userId - Owner id.
   * @param {number} id - Entry id.
   * @param {object} request - Ledger request.
   * @returns {object} Ledger response.
   * @throws {BusinessError} When the entry does not exist.
   */
  update(userId, id, request) {
    const existing = this.repository.findByIdAndUser(id, userId);
    if (!existing) {
      throw new BusinessError('收支记录不存在');
    }
    const entry = this.repository.update(id, userId, this.#applyRequest(request));
    return this.#toResponse(entry);
  }

  /**
   * Delete a ledger entry.
   *
   * @param {number} userId - Owner id.
   * @param {number} id - Entry id.
   * @returns {void}
   * @throws {BusinessError} When the entry does not exist.
   */
  delete(userId, id) {
    const existing = this.repository.findByIdAndUser(id, userId);
    if (!existing) {
      throw new BusinessError('收支记录不存在');
    }
    this.repository.deleteByIdAndUser(id, userId);
  }

  /**
   * List ledger entries matching the given filters.
   *
   * @param {number} userId - Owner id.
   * @param {string} [type] - Optional type filter.
   * @param {string} [start] - Optional start date (yyyy-MM-dd).
   * @param {string} [end] - Optional end date (yyyy-MM-dd).
   * @param {string} [tag] - Optional tag filter.
   * @returns {object[]} Ledger responses.
   */
  list(userId, type, start, end, tag) {
    return this.#query(userId, type, start, end, tag).map((entry) => this.#toResponse(entry));
  }

  /**
   * Compute aggregate statistics for the matching entries.
   *
   * @param {number} userId - Owner id.
   * @param {string} [type] - Optional type filter.
   * @param {string} [start] - Optional start date.
   * @param {string} [end] - Optional end date.
   * @param {string} [tag] - Optional tag filter.
   * @returns {object} Ledger statistics.
   */
  statistics(userId, type, start, end, tag) {
    const entries = this.#query(userId, type, start, end, tag);
    let totalIncome = 0;
    let totalExpense = 0;
    const incomeByTag = new Map();
    const expenseByTag = new Map();
    const monthly = new Map();
    for (const entry of entries) {
      const amount = entry.amount ?? 0;
      const income = entry.type === LedgerType.INCOME;
      if (income) {
        totalIncome += amount;
      } else {
        totalExpense += amount;
      }
      this.#accumulateTags(income ? incomeByTag : expenseByTag, entry.tags, amount);
      const month = entry.entryDate ? entry.entryDate.slice(0, 7) : '';
      const point = monthly.get(month) ?? [0, 0];
      if (income) {
        point[0] += amount;
      } else {
        point[1] += amount;
      }
      monthly.set(month, point);
    }
    const trend = [...monthly.keys()].sort().map((month) => {
      const [inc, exp] = monthly.get(month);
      return { label: month, income: fromCents(inc), expense: fromCents(exp) };
    });
    return {
      totalIncome: fromCents(totalIncome),
      totalExpense: fromCents(totalExpense),
      balance: fromCents(totalIncome - totalExpense),
      count: entries.length,
      incomeByTag: this.#toTagAmounts(incomeByTag),
      expenseByTag: this.#toTagAmounts(expenseByTag),
      monthlyTrend: trend,
    };
  }

  /**
   * Export the matching entries as CSV (UTF-8 BOM prefixed).
   *
   * @param {number} userId - Owner id.
   * @param {string} [type] - Optional type filter.
   * @param {string} [start] - Optional start date.
   * @param {string} [end] - Optional end date.
   * @param {string} [tag] - Optional tag filter.
   * @returns {string} CSV content.
   */
  exportCsv(userId, type, start, end, tag) {
    const entries = this.#query(userId, type, start, end, tag);
    let sb = '\uFEFF';
    sb += '日期,类型,金额,标签,备注\n';
    for (const entry of entries) {
      sb += `${entry.entryDate ?? ''},`;
      sb += `${entry.type === LedgerType.INCOME ? '收入' : '支出'},`;
      sb += `${formatCents(entry.amount ?? 0)},`;
      sb += `${escapeCsv((entry.tags ?? []).join('|'))},`;
      sb += `${escapeCsv(entry.remark)}\n`;
    }
    return sb;
  }

  /**
   * Run the shared query with validation.
   *
   * @param {number} userId - Owner id.
   * @param {string} [type] - Optional type filter.
   * @param {string} [start] - Optional start date.
   * @param {string} [end] - Optional end date.
   * @param {string} [tag] - Optional tag filter.
   * @returns {object[]} Matching entries.
   * @throws {BusinessError} When start is after end.
   */
  #query(userId, type, start, end, tag) {
    const ledgerType = parseType(type);
    const normalizedTag =
      tag === null || tag === undefined || String(tag).trim() === '' ? null : String(tag).trim();
    const normalizedStart = start === null || start === undefined || start === '' ? null : start;
    const normalizedEnd = end === null || end === undefined || end === '' ? null : end;
    if (normalizedStart && normalizedEnd && normalizedStart > normalizedEnd) {
      throw new BusinessError('起始日期不能晚于结束日期');
    }
    return this.repository.search({
      userId,
      type: ledgerType,
      start: normalizedStart,
      end: normalizedEnd,
      tag: normalizedTag,
    });
  }

  /**
   * Build the persisted column values from a request.
   *
   * @param {object} request - Ledger request.
   * @returns {object} Column values.
   */
  #applyRequest(request) {
    return {
      type: parseRequiredType(request.type),
      amount: Math.round(Number(request.amount ?? 0) * 100),
      entryDate: request.entryDate,
      tags: normalizeTags(request.tags),
      remark: request.remark ?? null,
    };
  }

  /**
   * Accumulate an amount into the per-tag map (bucketing untagged as 未分类).
   *
   * @param {Map<string, number>} target - Target map (cents).
   * @param {string[]} tags - Entry tags.
   * @param {number} amount - Amount in cents.
   * @returns {void}
   */
  #accumulateTags(target, tags, amount) {
    if (!tags || tags.length === 0) {
      target.set(UNCATEGORISED, (target.get(UNCATEGORISED) ?? 0) + amount);
      return;
    }
    for (const tag of tags) {
      target.set(tag, (target.get(tag) ?? 0) + amount);
    }
  }

  /**
   * Convert a per-tag cents map into a list of {tag, amount} objects.
   *
   * @param {Map<string, number>} map - Per-tag map (cents).
   * @returns {Array<{ tag: string, amount: number }>} Tag amounts.
   */
  #toTagAmounts(map) {
    return [...map.entries()].map(([tag, amount]) => ({ tag, amount: fromCents(amount) }));
  }

  /**
   * Convert an entry entity into a response object.
   *
   * @param {object} entry - Entry entity (amount in cents).
   * @returns {object} Ledger response.
   */
  #toResponse(entry) {
    return {
      id: entry.id,
      type: entry.type ?? null,
      amount: fromCents(entry.amount ?? 0),
      entryDate: entry.entryDate,
      tags: [...(entry.tags ?? [])],
      remark: entry.remark,
    };
  }
}

export default LedgerService;
