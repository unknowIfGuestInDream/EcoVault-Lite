import { BusinessError } from '../common/errors.js';
import { encrypt, decrypt } from '../security/crypto.js';
import { evaluate } from '../security/passwordStrength.js';

/**
 * @file Password vault service.
 *
 * Reproduces the Java `PasswordServiceImpl`: secret/notes/tags are AES-encrypted
 * at rest, list responses mask the secret (and omit notes/category/strength)
 * while still exposing decrypted tags, and detail responses decrypt everything.
 */

/** The masked placeholder returned for secrets in list responses. */
export const MASKED_SECRET = '******';

/**
 * Encrypt a comma-joined tag list into a single ciphertext.
 *
 * @param {string[] | null | undefined} tags - Raw tags.
 * @returns {string | null} Ciphertext or null when there are no usable tags.
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
 * Decrypt a tag ciphertext back into an array.
 *
 * @param {string | null | undefined} cipher - Tag ciphertext.
 * @returns {string[]} Decrypted tags (never null).
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
 * Password vault service.
 */
export class PasswordService {
  /**
   * @param {object} deps - Dependencies.
   * @param {object} deps.repository - Entry repo.
   */
  constructor({ repository }) {
    this.repository = repository;
  }

  /**
   * Build the persisted column values from a request.
   *
   * @param {object} request - Password entry request.
   * @returns {object} Column values (secret/notes/tags encrypted, strength scored).
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
   * Create a new entry.
   *
   * @param {number} userId - Owner id.
   * @param {object} request - Password entry request.
   * @returns {object} Detail response (decrypted).
   */
  create(userId, request) {
    const entry = this.repository.insert({ userId, ...this.#applyRequest(request) });
    return this.#toResponse(entry);
  }

  /**
   * Update an existing entry.
   *
   * @param {number} userId - Owner id.
   * @param {number} id - Entry id.
   * @param {object} request - Password entry request.
   * @returns {object} Detail response (decrypted).
   * @throws {BusinessError} When the entry does not exist.
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
   * Delete an entry.
   *
   * @param {number} userId - Owner id.
   * @param {number} id - Entry id.
   * @returns {void}
   * @throws {BusinessError} When the entry does not exist.
   */
  delete(userId, id) {
    const existing = this.repository.findByIdAndUser(id, userId);
    if (!existing) {
      throw new BusinessError('密码条目不存在');
    }
    this.repository.deleteByIdAndUser(id, userId);
  }

  /**
   * Fetch a single entry (decrypted).
   *
   * @param {number} userId - Owner id.
   * @param {number} id - Entry id.
   * @returns {object} Detail response.
   * @throws {BusinessError} When the entry does not exist.
   */
  get(userId, id) {
    const entry = this.repository.findByIdAndUser(id, userId);
    if (!entry) {
      throw new BusinessError('密码条目不存在');
    }
    return this.#toResponse(entry);
  }

  /**
   * List a user's entries (masked), optionally filtered by title keyword and tag.
   *
   * @param {number} userId - Owner id.
   * @param {string} [keyword] - Optional title keyword.
   * @param {string} [tag] - Optional exact tag filter (case-insensitive).
   * @returns {object[]} List responses (masked secret, decrypted tags).
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
   * Build a detail response (decrypt secret/notes, expose strength).
   *
   * @param {object} entry - Entry entity.
   * @returns {object} Detail response.
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
   * Build a masked list response.
   *
   * @param {object} entry - Entry entity.
   * @returns {object} List response.
   */
  #toListResponse(entry) {
    return this.#buildResponse(entry, MASKED_SECRET, null, null, 0, null);
  }

  /**
   * Assemble a response object with the given secret/notes/category/strength.
   *
   * @param {object} entry - Entry entity.
   * @param {string | null} secret - Secret value (masked or decrypted).
   * @param {string | null} notes - Notes value.
   * @param {string | null} category - Category value.
   * @param {number} strengthScore - Strength score.
   * @param {string | null} strengthLevel - Strength level.
   * @returns {object} Response object.
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
