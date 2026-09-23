import { BusinessError } from '../common/errors.js';
import { LedgerType } from '../domain/ledgerType.js';
import { fromCents, formatCents } from '../utils/money.js';

/**
 * @file 账本（收入/支出）服务。
 *
 * 账本服务能力：CRUD、筛选查询、聚合统计（总额、
 * 保留首次出现顺序的按标签明细、月度
 * 趋势升序排序）以及带 BOM 前缀的 CSV 导出。
 */

/** 用于无标签条目的分桶标签。 */
const UNCATEGORISED = '未分类';

/**
 * 解析可选的账本类型字符串。
 *
 * @param {string | null | undefined} type - 输入类型。
 * @returns {string | null} 有效的 {@link LedgerType}，为空时返回 null。
 * @throws {BusinessError} 当值非空但无效时。
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
 * 解析必填的账本类型字符串。
 *
 * @param {string | null | undefined} type - 输入类型。
 * @returns {string} 有效的 {@link LedgerType}。
 * @throws {BusinessError} 当值为空或无效时。
 */
function parseRequiredType(type) {
  const parsed = parseType(type);
  if (parsed === null) {
    throw new BusinessError('收支类型不合法');
  }
  return parsed;
}

/**
 * 规范化标签列表：去除首尾空白、丢弃空值、保序去重。
 *
 * @param {string[] | null | undefined} tags - 输入标签。
 * @returns {string[]} 规范化后的标签。
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
 * 转义用于 CSV 输出的值。
 *
 * @param {string | null | undefined} value - 输入值。
 * @returns {string} 转义后的值。
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
 * 账本服务。
 */
export class LedgerService {
  /**
   * @param {object} deps - 依赖项。
   * @param {object} deps.repository - 账本仓储。
   */
  constructor({ repository }) {
    this.repository = repository;
  }

  /**
   * 创建账本条目。
   *
   * @param {number} userId - 所有者 id。
   * @param {object} request - 账本请求。
   * @returns {object} 账本响应。
   */
  create(userId, request) {
    const entry = this.repository.insert({ userId, ...this.#applyRequest(request) });
    return this.#toResponse(entry);
  }

  /**
   * 更新账本条目。
   *
   * @param {number} userId - 所有者 id。
   * @param {number} id - 条目 id。
   * @param {object} request - 账本请求。
   * @returns {object} 账本响应。
   * @throws {BusinessError} 当条目不存在时。
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
   * 删除账本条目。
   *
   * @param {number} userId - 所有者 id。
   * @param {number} id - 条目 id。
   * @returns {void}
   * @throws {BusinessError} 当条目不存在时。
   */
  delete(userId, id) {
    const existing = this.repository.findByIdAndUser(id, userId);
    if (!existing) {
      throw new BusinessError('收支记录不存在');
    }
    this.repository.deleteByIdAndUser(id, userId);
  }

  /**
   * 列出匹配给定筛选条件的账本条目。
   *
   * @param {number} userId - 所有者 id。
   * @param {string} [type] - 可选类型筛选。
   * @param {string} [start] - 可选起始日期（yyyy-MM-dd）。
   * @param {string} [end] - 可选结束日期（yyyy-MM-dd）。
   * @param {string} [tag] - 可选标签筛选。
   * @returns {object[]} 账本响应。
   */
  list(userId, type, start, end, tag) {
    return this.#query(userId, type, start, end, tag).map((entry) => this.#toResponse(entry));
  }

  /**
   * 计算匹配条目的聚合统计。
   *
   * @param {number} userId - 所有者 id。
   * @param {string} [type] - 可选类型筛选。
   * @param {string} [start] - 可选起始日期。
   * @param {string} [end] - 可选结束日期。
   * @param {string} [tag] - 可选标签筛选。
   * @returns {object} 账本统计。
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
   * 将匹配条目导出为 CSV（带 UTF-8 BOM 前缀）。
   *
   * @param {number} userId - 所有者 id。
   * @param {string} [type] - 可选类型筛选。
   * @param {string} [start] - 可选起始日期。
   * @param {string} [end] - 可选结束日期。
   * @param {string} [tag] - 可选标签筛选。
   * @returns {string} CSV 内容。
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
   * 运行带校验的共享查询。
   *
   * @param {number} userId - 所有者 id。
   * @param {string} [type] - 可选类型筛选。
   * @param {string} [start] - 可选起始日期。
   * @param {string} [end] - 可选结束日期。
   * @param {string} [tag] - 可选标签筛选。
   * @returns {object[]} 匹配的条目。
   * @throws {BusinessError} 当起始日期晚于结束日期时。
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
   * 根据请求构建持久化列值。
   *
   * @param {object} request - 账本请求。
   * @returns {object} 列值。
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
   * 将金额累加到按标签 map（未标记项归入未分类）。
   *
   * @param {Map<string, number>} target - 目标 map（整数分）。
   * @param {string[]} tags - 条目标签。
   * @param {number} amount - 以整数分表示的金额。
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
   * 将按标签的整数分 map 转换为 {tag, amount} 对象列表。
   *
   * @param {Map<string, number>} map - 按标签 map（整数分）。
   * @returns {Array<{ tag: string, amount: number }>} 标签金额。
   */
  #toTagAmounts(map) {
    return [...map.entries()].map(([tag, amount]) => ({ tag, amount: fromCents(amount) }));
  }

  /**
   * 将条目实体转换为响应对象。
   *
   * @param {object} entry - 条目实体（金额以整数分表示）。
   * @returns {object} 账本响应。
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
