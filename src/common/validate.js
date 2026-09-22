import { ValidationError } from './errors.js';
import { isValidDate } from '../utils/datetime.js';

/**
 * @file Request validation.
 *
 * Mirrors the Java bean-validation constraints on the request DTOs. Each
 * `validate*` function returns a normalised object on success, or throws a
 * {@link ValidationError} whose message is the failed field messages joined by
 * `"; "` (matching the Java `GlobalExceptionHandler` behaviour).
 */

/**
 * Whether a value is "blank" (null/undefined or only whitespace).
 *
 * @param {unknown} value - Candidate value.
 * @returns {boolean} True when the value is blank.
 */
function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

/**
 * Length of a string value (0 for null/undefined).
 *
 * @param {unknown} value - Candidate value.
 * @returns {number} String length.
 */
function len(value) {
  return value === null || value === undefined ? 0 : String(value).length;
}

/**
 * A small collector of validation messages.
 */
class Errors {
  constructor() {
    /** @type {string[]} */
    this.messages = [];
  }

  /**
   * Add a message when the condition holds.
   *
   * @param {boolean} condition - When true, the message is recorded.
   * @param {string} message - Message to record.
   * @returns {void}
   */
  addIf(condition, message) {
    if (condition) {
      this.messages.push(message);
    }
  }

  /**
   * Throw a {@link ValidationError} if any messages were collected.
   *
   * @returns {void}
   */
  throwIfAny() {
    if (this.messages.length > 0) {
      throw new ValidationError(this.messages);
    }
  }
}

/**
 * Coerce a value to a finite number or return undefined.
 *
 * @param {unknown} value - Candidate value.
 * @returns {number | undefined} Parsed number or undefined.
 */
function toNumberOrUndefined(value) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Validate a registration request.
 *
 * @param {object} body - Raw request body.
 * @returns {object} Normalised request.
 * @throws {ValidationError} On constraint violations.
 */
export function validateRegister(body = {}) {
  const errors = new Errors();
  if (isBlank(body.username)) {
    errors.addIf(true, '用户名不能为空');
  } else {
    errors.addIf(len(body.username) < 3 || len(body.username) > 32, '用户名长度需在 3-32 之间');
  }
  if (isBlank(body.password)) {
    errors.addIf(true, '密码不能为空');
  } else {
    errors.addIf(len(body.password) < 6 || len(body.password) > 64, '密码长度需在 6-64 之间');
  }
  errors.addIf(body.nickname != null && len(body.nickname) > 64, '昵称过长');
  errors.addIf(body.email != null && len(body.email) > 128, '邮箱过长');
  errors.throwIfAny();
  return {
    username: body.username,
    password: body.password,
    nickname: body.nickname ?? null,
    email: body.email ?? null,
    role: body.role ?? null,
  };
}

/**
 * Validate a login request.
 *
 * @param {object} body - Raw request body.
 * @returns {{ username: string, password: string }} Normalised request.
 * @throws {ValidationError} On constraint violations.
 */
export function validateLogin(body = {}) {
  const errors = new Errors();
  errors.addIf(isBlank(body.username), '用户名不能为空');
  errors.addIf(isBlank(body.password), '密码不能为空');
  errors.throwIfAny();
  return { username: body.username, password: body.password };
}

/**
 * Validate a change-password request.
 *
 * @param {object} body - Raw request body.
 * @returns {{ oldPassword: string, newPassword: string }} Normalised request.
 * @throws {ValidationError} On constraint violations.
 */
export function validateChangePassword(body = {}) {
  const errors = new Errors();
  errors.addIf(isBlank(body.oldPassword), '原密码不能为空');
  if (isBlank(body.newPassword)) {
    errors.addIf(true, '新密码不能为空');
  } else {
    errors.addIf(
      len(body.newPassword) < 6 || len(body.newPassword) > 64,
      '新密码长度需在 6-64 之间'
    );
  }
  errors.throwIfAny();
  return { oldPassword: body.oldPassword, newPassword: body.newPassword };
}

/**
 * Validate a profile-update request.
 *
 * @param {object} body - Raw request body.
 * @returns {{ nickname: (string|null), email: (string|null) }} Normalised request.
 * @throws {ValidationError} On constraint violations.
 */
export function validateUpdateProfile(body = {}) {
  const errors = new Errors();
  errors.addIf(body.nickname != null && len(body.nickname) > 64, '昵称过长');
  errors.addIf(body.email != null && len(body.email) > 128, '邮箱过长');
  errors.throwIfAny();
  return { nickname: body.nickname ?? null, email: body.email ?? null };
}

/**
 * Validate a verify-password request.
 *
 * @param {object} body - Raw request body.
 * @returns {{ password: string }} Normalised request.
 * @throws {ValidationError} On constraint violations.
 */
export function validateVerifyPassword(body = {}) {
  const errors = new Errors();
  errors.addIf(isBlank(body.password), '密码不能为空');
  errors.throwIfAny();
  return { password: body.password };
}

/**
 * Normalise a tag list input into an array of strings.
 *
 * @param {unknown} tags - Raw tags value.
 * @param {Errors} errors - Error collector.
 * @returns {string[] | null} Normalised tags or null.
 */
function normaliseTagsInput(tags, errors) {
  if (tags === null || tags === undefined) {
    return null;
  }
  if (!Array.isArray(tags)) {
    errors.addIf(true, '标签格式不正确');
    return null;
  }
  return tags.map((tag) => (tag === null || tag === undefined ? '' : String(tag)));
}

/**
 * Validate a password-entry request.
 *
 * @param {object} body - Raw request body.
 * @returns {object} Normalised request.
 * @throws {ValidationError} On constraint violations.
 */
export function validatePasswordEntry(body = {}) {
  const errors = new Errors();
  if (isBlank(body.title)) {
    errors.addIf(true, '标题不能为空');
  } else {
    errors.addIf(len(body.title) > 128, '标题过长');
  }
  errors.addIf(body.account != null && len(body.account) > 128, '账号过长');
  errors.addIf(isBlank(body.secret), '密码不能为空');
  errors.addIf(body.url != null && len(body.url) > 256, '站点地址过长');
  errors.addIf(body.category != null && len(body.category) > 64, '分类过长');
  const tags = normaliseTagsInput(body.tags, errors);
  errors.throwIfAny();
  return {
    title: body.title,
    account: body.account ?? null,
    secret: body.secret,
    url: body.url ?? null,
    notes: body.notes ?? null,
    category: body.category ?? null,
    tags: tags ?? [],
  };
}

/** Money field names accepted on a salary request. */
const SALARY_MONEY_FIELDS = [
  'baseSalary',
  'performanceSalary',
  'housingAllowance',
  'mealAllowance',
  'transportAllowance',
  'overtimePay',
  'overtimeAllowance',
  'bonus',
  'medicalBase',
  'pensionUnemploymentBase',
  'housingFundBase',
  'medicalDeduction',
  'pensionDeduction',
  'unemploymentDeduction',
  'housingFundDeduction',
  'incomeTax',
  'seriousIllnessMedical',
  'heatingAllowance',
  'netPay',
];

/**
 * Validate a salary request.
 *
 * @param {object} body - Raw request body.
 * @returns {object} Normalised request (year/month ints, money numbers).
 * @throws {ValidationError} On constraint violations.
 */
export function validateSalary(body = {}) {
  const errors = new Errors();
  const year = toNumberOrUndefined(body.year);
  const month = toNumberOrUndefined(body.month);
  if (body.year === null || body.year === undefined || body.year === '') {
    errors.addIf(true, '年份不能为空');
  } else {
    errors.addIf(
      year === undefined || !Number.isInteger(year) || year < 1970 || year > 9999,
      '年份不合法'
    );
  }
  if (body.month === null || body.month === undefined || body.month === '') {
    errors.addIf(true, '月份不能为空');
  } else {
    errors.addIf(
      month === undefined || !Number.isInteger(month) || month < 0 || month > 12,
      '月份需在 0-12 之间 (0 表示年终奖)'
    );
  }
  const normalised = { year, month, remark: body.remark ?? null };
  for (const field of SALARY_MONEY_FIELDS) {
    if (body[field] === null || body[field] === undefined || body[field] === '') {
      normalised[field] = undefined;
    } else {
      const value = toNumberOrUndefined(body[field]);
      errors.addIf(value === undefined, '数值格式不正确');
      normalised[field] = value;
    }
  }
  errors.throwIfAny();
  return normalised;
}

/**
 * Validate a ledger request.
 *
 * @param {object} body - Raw request body.
 * @returns {object} Normalised request.
 * @throws {ValidationError} On constraint violations.
 */
export function validateLedger(body = {}) {
  const errors = new Errors();
  errors.addIf(body.type === null || body.type === undefined, '收支类型不能为空');
  if (body.amount === null || body.amount === undefined || body.amount === '') {
    errors.addIf(true, '金额不能为空');
  } else {
    const amount = toNumberOrUndefined(body.amount);
    errors.addIf(amount === undefined || amount < 0.01, '金额需大于 0');
  }
  if (isBlank(body.entryDate)) {
    errors.addIf(true, '发生日期不能为空');
  } else {
    errors.addIf(!isValidDate(String(body.entryDate)), '发生日期格式不正确');
  }
  const tags = normaliseTagsInput(body.tags, errors);
  errors.throwIfAny();
  return {
    type: body.type,
    amount: toNumberOrUndefined(body.amount),
    entryDate: String(body.entryDate),
    tags: tags ?? [],
    remark: body.remark ?? null,
  };
}

/**
 * Validate an admin user-update request.
 *
 * @param {object} body - Raw request body.
 * @returns {object} Normalised request.
 * @throws {ValidationError} On constraint violations.
 */
export function validateUpdateUser(body = {}) {
  const errors = new Errors();
  errors.addIf(body.nickname != null && len(body.nickname) > 64, '昵称过长');
  errors.addIf(body.email != null && len(body.email) > 128, '邮箱过长');
  errors.addIf(body.password != null && len(body.password) > 64, '密码过长');
  let enabled;
  if (body.enabled === null || body.enabled === undefined) {
    enabled = null;
  } else if (typeof body.enabled === 'boolean') {
    enabled = body.enabled;
  } else if (body.enabled === 'true' || body.enabled === 'false') {
    enabled = body.enabled === 'true';
  } else {
    errors.addIf(true, '状态格式不正确');
    enabled = null;
  }
  errors.throwIfAny();
  return {
    nickname: body.nickname ?? null,
    email: body.email ?? null,
    role: body.role ?? null,
    enabled,
    password: body.password ?? null,
  };
}

/**
 * Validate a log-update request.
 *
 * @param {object} body - Raw request body.
 * @returns {{ module: (string|null), operation: (string|null) }} Normalised request.
 * @throws {ValidationError} On constraint violations.
 */
export function validateUpdateLog(body = {}) {
  const errors = new Errors();
  errors.addIf(body.module != null && len(body.module) > 64, '模块名称过长');
  errors.addIf(body.operation != null && len(body.operation) > 256, '操作描述过长');
  errors.throwIfAny();
  return { module: body.module ?? null, operation: body.operation ?? null };
}

/**
 * Validate a role-permission update request.
 *
 * @param {object} body - Raw request body.
 * @returns {{ pages: (string[]|null) }} Normalised request.
 * @throws {ValidationError} On constraint violations.
 */
export function validateUpdateRolePermission(body = {}) {
  const errors = new Errors();
  let pages = null;
  if (body.pages !== null && body.pages !== undefined) {
    if (!Array.isArray(body.pages)) {
      errors.addIf(true, '页面列表格式不正确');
    } else {
      pages = body.pages.map((p) => (p === null || p === undefined ? '' : String(p)));
    }
  }
  errors.throwIfAny();
  return { pages };
}

export default {
  validateRegister,
  validateLogin,
  validateChangePassword,
  validateUpdateProfile,
  validateVerifyPassword,
  validatePasswordEntry,
  validateSalary,
  validateLedger,
  validateUpdateUser,
  validateUpdateLog,
  validateUpdateRolePermission,
};
