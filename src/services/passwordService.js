import { BusinessError } from '../common/errors.js';
import { encrypt, decrypt } from '../security/crypto.js';
import { evaluate } from '../security/passwordStrength.js';

/**
 * @file 密码保险箱服务。
 *
 * 复现 Java `PasswordServiceImpl`：secret/notes/tags 使用 AES 加密
 * 静态存储，列表响应会脱敏 secret（并省略 notes/category/strength）
 * 但仍暴露解密后的 tags，详情响应会解密所有内容。
 */

/** 列表响应中为 secret 返回的脱敏占位符。 */
export const MASKED_SECRET = '******';

/**
 * 将逗号拼接的标签列表加密为单个密文。
 *
 * @param {string[] | null | undefined} tags - 原始标签。
 * @returns {string | null} 密文；没有可用标签时为 null。
 */
function encryptTags(tags) {
  if (!tags || tags.length === 0) {
    return null;
  }
  const joined = tags
    .filter((tag) => tag !== null && tag !== undefined && String(tag).trim() !== '')
    .map((tag) => String(tag).trim())
    .join(',');
  return joined === '' ? null : encrypt(joined);
}

/**
 * 将标签密文解密回数组。
 *
 * @param {string | null | undefined} cipher - 标签密文。
 * @returns {string[]} 解密后的标签（永不为 null）。
 */
function decryptTags(cipher) {
  if (cipher === null || cipher === undefined || String(cipher).trim() === '') {
    return [];
  }
  const joined = decrypt(cipher);
  if (!joined || joined.trim() === '') {
    return [];
  }
  return joined.split(',').filter((tag) => tag.trim() !== '');
}

/**
 * 密码保险箱服务。
 */
export class PasswordService {
  /**
   * @param {object} deps - 依赖项。
   * @param {object} deps.repository - 条目仓储。
   */
  constructor({ repository }) {
    this.repository = repository;
  }

  /**
   * 根据请求构建持久化列值。
   *
   * @param {object} request - 密码条目请求。
   * @returns {object} 列值（secret/notes/tags 已加密，强度已评分）。
   */
  #applyRequest(request) {
    const strength = evaluate(request.secret);
    return {
      title: request.title,
      account: request.account ?? null,
      url: request.url ?? null,
      category: request.category ?? null,
      secret: encrypt(request.secret),
      notes: encrypt(request.notes ?? null),
      tags: encryptTags(request.tags),
      strengthScore: strength.score,
      strengthLevel: strength.level,
    };
  }

  /**
   * 创建新条目。
   *
   * @param {number} userId - 所有者 id。
   * @param {object} request - 密码条目请求。
   * @returns {object} 详情响应（已解密）。
   */
  create(userId, request) {
    const entry = this.repository.insert({ userId, ...this.#applyRequest(request) });
    return this.#toResponse(entry);
  }

  /**
   * 更新现有条目。
   *
   * @param {number} userId - 所有者 id。
   * @param {number} id - 条目 id。
   * @param {object} request - 密码条目请求。
   * @returns {object} 详情响应（已解密）。
   * @throws {BusinessError} 当条目不存在时。
   */
  update(userId, id, request) {
    const existing = this.repository.findByIdAndUser(id, userId);
    if (!existing) {
      throw new BusinessError('密码条目不存在');
    }
    const entry = this.repository.update(id, userId, this.#applyRequest(request));
    return this.#toResponse(entry);
  }

  /**
   * 删除条目。
   *
   * @param {number} userId - 所有者 id。
   * @param {number} id - 条目 id。
   * @returns {void}
   * @throws {BusinessError} 当条目不存在时。
   */
  delete(userId, id) {
    const existing = this.repository.findByIdAndUser(id, userId);
    if (!existing) {
      throw new BusinessError('密码条目不存在');
    }
    this.repository.deleteByIdAndUser(id, userId);
  }

  /**
   * 获取单个条目（已解密）。
   *
   * @param {number} userId - 所有者 id。
   * @param {number} id - 条目 id。
   * @returns {object} 详情响应。
   * @throws {BusinessError} 当条目不存在时。
   */
  get(userId, id) {
    const entry = this.repository.findByIdAndUser(id, userId);
    if (!entry) {
      throw new BusinessError('密码条目不存在');
    }
    return this.#toResponse(entry);
  }

  /**
   * 列出用户条目（已脱敏），可按标题关键字和标签筛选。
   *
   * @param {number} userId - 所有者 id。
   * @param {string} [keyword] - 可选标题关键字。
   * @param {string} [tag] - 可选精确标签筛选（不区分大小写）。
   * @returns {object[]} 列表响应（脱敏 secret，解密 tags）。
   */
  list(userId, keyword, tag) {
    const entries =
      keyword === null || keyword === undefined || String(keyword).trim() === ''
        ? this.repository.findByUser(userId)
        : this.repository.searchByTitle(userId, String(keyword).trim());
    let responses = entries.map((entry) => this.#toListResponse(entry));
    if (tag !== null && tag !== undefined && String(tag).trim() !== '') {
      const target = String(tag).trim().toLowerCase();
      responses = responses.filter((r) => r.tags.some((t) => t.toLowerCase() === target));
    }
    return responses;
  }

  /**
   * 构建详情响应（解密 secret/notes，暴露强度）。
   *
   * @param {object} entry - 条目实体。
   * @returns {object} 详情响应。
   */
  #toResponse(entry) {
    return this.#buildResponse(
      entry,
      decrypt(entry.secret),
      decrypt(entry.notes),
      entry.category,
      entry.strengthScore,
      entry.strengthLevel
    );
  }

  /**
   * 构建脱敏列表响应。
   *
   * @param {object} entry - 条目实体。
   * @returns {object} 列表响应。
   */
  #toListResponse(entry) {
    return this.#buildResponse(entry, MASKED_SECRET, null, null, 0, null);
  }

  /**
   * 使用给定的 secret/notes/category/strength 组装响应对象。
   *
   * @param {object} entry - 条目实体。
   * @param {string | null} secret - Secret 值（脱敏或解密后）。
   * @param {string | null} notes - Notes 值。
   * @param {string | null} category - Category 值。
   * @param {number} strengthScore - 强度分数。
   * @param {string | null} strengthLevel - 强度等级。
   * @returns {object} 响应对象。
   */
  #buildResponse(entry, secret, notes, category, strengthScore, strengthLevel) {
    return {
      id: entry.id,
      title: entry.title,
      account: entry.account,
      secret,
      url: entry.url,
      notes,
      category,
      tags: decryptTags(entry.tags),
      strengthScore,
      strengthLevel,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }
}

export default PasswordService;
