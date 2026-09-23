import { ValidationError } from './errors.js';
import { isValidDate } from '../utils/datetime.js';

/**
 * @file 请求校验。
 *
 * 请求校验规则。每个 `validate*` 函数成功时返回规范化对象，或抛出
 * {@link ValidationError}，其消息为校验失败的字段消息以
 * `"; "` 拼接。
 */

/**
 * 判断值是否为 "blank"（null/undefined 或仅包含空白字符）。
 *
 * @param {unknown} value - 候选值。
 * @returns {boolean} 值为空白时返回 true。
 */
function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

/**
 * 字符串值的长度（null/undefined 时为 0）。
 *
 * @param {unknown} value - 候选值。
 * @returns {number} 字符串长度。
 */
function len(value) {
  return value === null || value === undefined ? 0 : String(value).length;
}

/**
 * 一个小型校验消息收集器。
 */
class Errors {
  constructor() {
    /** @type {string[]} */
    this.messages = [];
  }

  /**
   * 条件成立时添加消息。
   *
   * @param {boolean} condition - 为 true 时记录消息。
   * @param {string} message - 要记录的消息。
   * @returns {void}
   */
  addIf(condition, message) {
    if (condition) {
      this.messages.push(message);
    }
  }

  /**
   * 如果收集到任何消息，则抛出 {@link ValidationError}。
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
 * 将值强制转换为有限数字，或返回 undefined。
 *
 * @param {unknown} value - 候选值。
 * @returns {number | undefined} 解析后的数字或 undefined。
 */
function toNumberOrUndefined(value) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * 校验注册请求。
 *
 * @param {object} body - 请求体。
 * @returns {object} 规范化后的请求。
 * @throws {ValidationError} 约束违反时抛出。
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
 * 校验登录请求。
 *
 * @param {object} body - 请求体。
 * @returns {{ username: string, password: string }} 规范化后的请求。
 * @throws {ValidationError} 约束违反时抛出。
 */
export function validateLogin(body = {}) {
  const errors = new Errors();
  errors.addIf(isBlank(body.username), '用户名不能为空');
  errors.addIf(isBlank(body.password), '密码不能为空');
  errors.throwIfAny();
  return { username: body.username, password: body.password };
}

/**
 * 校验修改密码请求。
 *
 * @param {object} body - 请求体。
 * @returns {{ oldPassword: string, newPassword: string }} 规范化后的请求。
 * @throws {ValidationError} 约束违反时抛出。
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
 * 校验资料更新请求。
 *
 * @param {object} body - 请求体。
 * @returns {{ nickname: (string|null), email: (string|null) }} 规范化后的请求。
 * @throws {ValidationError} 约束违反时抛出。
 */
export function validateUpdateProfile(body = {}) {
  const errors = new Errors();
  errors.addIf(body.nickname != null && len(body.nickname) > 64, '昵称过长');
  errors.addIf(body.email != null && len(body.email) > 128, '邮箱过长');
  errors.throwIfAny();
  return { nickname: body.nickname ?? null, email: body.email ?? null };
}

/**
 * 校验密码验证请求。
 *
 * @param {object} body - 请求体。
 * @returns {{ password: string }} 规范化后的请求。
 * @throws {ValidationError} 约束违反时抛出。
 */
export function validateVerifyPassword(body = {}) {
  const errors = new Errors();
  errors.addIf(isBlank(body.password), '密码不能为空');
  errors.throwIfAny();
  return { password: body.password };
}

/**
 * 将标签列表输入规范化为字符串数组。
 *
 * @param {unknown} tags - 标签值。
 * @param {Errors} errors - 错误收集器。
 * @returns {string[] | null} 规范化后的标签或 null。
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
 * 校验密码条目请求。
 *
 * @param {object} body - 请求体。
 * @returns {object} 规范化后的请求。
 * @throws {ValidationError} 约束违反时抛出。
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

/** 工资请求中接受的金额字段名。 */
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
 * 校验工资请求。
 *
 * @param {object} body - 请求体。
 * @returns {object} 规范化后的请求（year/month 为整数，金额为数字）。
 * @throws {ValidationError} 约束违反时抛出。
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
 * 校验账本请求。
 *
 * @param {object} body - 请求体。
 * @returns {object} 规范化后的请求。
 * @throws {ValidationError} 约束违反时抛出。
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
 * 校验管理员用户更新请求。
 *
 * @param {object} body - 请求体。
 * @returns {object} 规范化后的请求。
 * @throws {ValidationError} 约束违反时抛出。
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
 * 校验日志更新请求。
 *
 * @param {object} body - 请求体。
 * @returns {{ module: (string|null), operation: (string|null) }} 规范化后的请求。
 * @throws {ValidationError} 约束违反时抛出。
 */
export function validateUpdateLog(body = {}) {
  const errors = new Errors();
  errors.addIf(body.module != null && len(body.module) > 64, '模块名称过长');
  errors.addIf(body.operation != null && len(body.operation) > 256, '操作描述过长');
  errors.throwIfAny();
  return { module: body.module ?? null, operation: body.operation ?? null };
}

/**
 * 校验角色权限更新请求。
 *
 * @param {object} body - 请求体。
 * @returns {{ pages: (string[]|null) }} 规范化后的请求。
 * @throws {ValidationError} 约束违反时抛出。
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
