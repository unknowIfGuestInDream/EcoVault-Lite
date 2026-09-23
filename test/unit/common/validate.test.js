import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import validate, {
  validateChangePassword,
  validateLedger,
  validateLogin,
  validatePasswordEntry,
  validateRegister,
  validateSalary,
  validateUpdateLog,
  validateUpdateProfile,
  validateUpdateRolePermission,
  validateUpdateUser,
  validateVerifyPassword,
} from '../../../src/common/validate.js';
import { ValidationError } from '../../../src/common/errors.js';

/**
 * @file 请求校验测试。
 */

const repeat = (value, length) => value.repeat(length);

const assertValidationError = (action, messages) => {
  assert.throws(action, (error) => {
    assert.ok(error instanceof ValidationError);
    assert.deepEqual(error.messages, messages);
    assert.equal(error.message, messages.join('; '));
    return true;
  });
};

const salaryMoneyFields = [
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

const validateSourcePath = new URL('../../../src/common/validate.js', import.meta.url).pathname;

test('默认导出包含所有校验函数', () => {
  assert.deepEqual(Object.keys(validate), [
    'validateRegister',
    'validateLogin',
    'validateChangePassword',
    'validateUpdateProfile',
    'validateVerifyPassword',
    'validatePasswordEntry',
    'validateSalary',
    'validateLedger',
    'validateUpdateUser',
    'validateUpdateLog',
    'validateUpdateRolePermission',
  ]);
});

test('私有 len 辅助函数处理 null、undefined 与普通值长度', () => {
  const fileSource = readFileSync(validateSourcePath, 'utf8');
  const match = /function len\(value\) \{[\s\S]*?\n\}/.exec(fileSource);
  assert.ok(match);

  // 保留原始字节偏移，确保 c8 将 VM 片段的分支覆盖率合并回源文件。
  const offsetPadding = ' '.repeat(match.index);
  const source = `${offsetPadding}${match[0]}
globalThis.__validatePrivate = { len };
`;
  const context = {};
  context.globalThis = context;

  runInNewContext(source, context, { filename: validateSourcePath });

  assert.equal(context.__validatePrivate.len(null), 0);
  assert.equal(context.__validatePrivate.len(undefined), 0);
  assert.equal(context.__validatePrivate.len('abc'), 3);
});

test('validateRegister 成功返回规范化注册数据', () => {
  assert.deepEqual(
    validateRegister({
      username: 'alice',
      password: 'secret1',
      nickname: '爱丽丝',
      email: 'alice@example.test',
      role: 'USER',
    }),
    {
      username: 'alice',
      password: 'secret1',
      nickname: '爱丽丝',
      email: 'alice@example.test',
      role: 'USER',
    }
  );
  assert.deepEqual(validateRegister({ username: 'bob', password: 'secret2' }), {
    username: 'bob',
    password: 'secret2',
    nickname: null,
    email: null,
    role: null,
  });
});

test('validateRegister 覆盖用户名、密码、昵称与邮箱错误', () => {
  assertValidationError(
    () => validateRegister({ username: ' ', password: '' }),
    ['用户名不能为空', '密码不能为空']
  );
  assertValidationError(
    () => validateRegister({ username: 'ab', password: '12345' }),
    ['用户名长度需在 3-32 之间', '密码长度需在 6-64 之间']
  );
  assertValidationError(
    () => validateRegister({ username: repeat('u', 33), password: repeat('p', 65) }),
    ['用户名长度需在 3-32 之间', '密码长度需在 6-64 之间']
  );
  assertValidationError(
    () =>
      validateRegister({
        username: 'valid',
        password: 'secret1',
        nickname: repeat('昵', 65),
        email: repeat('e', 129),
      }),
    ['昵称过长', '邮箱过长']
  );
});

test('validateLogin 成功返回登录数据并覆盖空白错误', () => {
  assert.deepEqual(validateLogin({ username: 'alice', password: 'secret1' }), {
    username: 'alice',
    password: 'secret1',
  });
  assertValidationError(
    () => validateLogin({ username: null, password: undefined }),
    ['用户名不能为空', '密码不能为空']
  );
});

test('validateChangePassword 成功返回修改密码数据并覆盖错误', () => {
  assert.deepEqual(
    validateChangePassword({ oldPassword: 'old-secret', newPassword: 'new-secret' }),
    { oldPassword: 'old-secret', newPassword: 'new-secret' }
  );
  assertValidationError(
    () => validateChangePassword({ oldPassword: '', newPassword: null }),
    ['原密码不能为空', '新密码不能为空']
  );
  assertValidationError(
    () => validateChangePassword({ oldPassword: 'old-secret', newPassword: '12345' }),
    ['新密码长度需在 6-64 之间']
  );
  assertValidationError(
    () => validateChangePassword({ oldPassword: 'old-secret', newPassword: repeat('p', 65) }),
    ['新密码长度需在 6-64 之间']
  );
});

test('validateUpdateProfile 成功规范化资料并覆盖长度错误', () => {
  assert.deepEqual(validateUpdateProfile({ nickname: '用户', email: 'u@example.test' }), {
    nickname: '用户',
    email: 'u@example.test',
  });
  assert.deepEqual(validateUpdateProfile(), { nickname: null, email: null });
  assertValidationError(
    () => validateUpdateProfile({ nickname: repeat('昵', 65), email: repeat('e', 129) }),
    ['昵称过长', '邮箱过长']
  );
});

test('validateVerifyPassword 成功返回密码并覆盖空白错误', () => {
  assert.deepEqual(validateVerifyPassword({ password: 'secret1' }), { password: 'secret1' });
  assertValidationError(() => validateVerifyPassword({ password: '   ' }), ['密码不能为空']);
});

test('validatePasswordEntry 成功规范化密码条目与标签', () => {
  assert.deepEqual(
    validatePasswordEntry({
      title: '邮箱',
      account: 'alice',
      secret: 'secret1',
      url: 'https://example.test',
      notes: '备注',
      category: '个人',
      tags: ['重要', null, undefined, 123],
    }),
    {
      title: '邮箱',
      account: 'alice',
      secret: 'secret1',
      url: 'https://example.test',
      notes: '备注',
      category: '个人',
      tags: ['重要', '', '', '123'],
    }
  );
  assert.deepEqual(validatePasswordEntry({ title: '邮箱', secret: 'secret1' }), {
    title: '邮箱',
    account: null,
    secret: 'secret1',
    url: null,
    notes: null,
    category: null,
    tags: [],
  });
});

test('validatePasswordEntry 覆盖标题、账号、密码、链接、分类与标签错误', () => {
  assertValidationError(
    () =>
      validatePasswordEntry({
        title: '',
        account: repeat('a', 129),
        secret: null,
        url: repeat('u', 257),
        category: repeat('c', 65),
        tags: '重要',
      }),
    ['标题不能为空', '账号过长', '密码不能为空', '站点地址过长', '分类过长', '标签格式不正确']
  );
  assertValidationError(
    () => validatePasswordEntry({ title: repeat('t', 129), secret: 'secret1' }),
    ['标题过长']
  );
});

test('validateSalary 成功规范化边界年份、月份和金额字段', () => {
  const body = { year: '1970', month: '0', remark: '年终奖' };
  salaryMoneyFields.forEach((field, index) => {
    body[field] = String(index + 1);
  });

  const actual = validateSalary(body);
  assert.equal(actual.year, 1970);
  assert.equal(actual.month, 0);
  assert.equal(actual.remark, '年终奖');
  salaryMoneyFields.forEach((field, index) => {
    assert.equal(actual[field], index + 1);
  });

  const upper = validateSalary({
    year: 9999,
    month: 12,
    baseSalary: null,
    performanceSalary: undefined,
    housingAllowance: '',
  });
  assert.equal(upper.year, 9999);
  assert.equal(upper.month, 12);
  assert.equal(upper.remark, null);
  assert.equal(upper.baseSalary, undefined);
  assert.equal(upper.performanceSalary, undefined);
  assert.equal(upper.housingAllowance, undefined);
});

test('validateSalary 覆盖年份为空与不合法错误', () => {
  for (const year of [null, undefined, '']) {
    assertValidationError(() => validateSalary({ year, month: 1 }), ['年份不能为空']);
  }
  for (const year of ['abc', '1970.5', 1969, 10000]) {
    assertValidationError(() => validateSalary({ year, month: 1 }), ['年份不合法']);
  }
});

test('validateSalary 覆盖月份为空与不合法错误', () => {
  for (const month of [null, undefined, '']) {
    assertValidationError(() => validateSalary({ year: 2024, month }), ['月份不能为空']);
  }
  for (const month of ['abc', '1.5', -1, 13]) {
    assertValidationError(
      () => validateSalary({ year: 2024, month }),
      ['月份需在 0-12 之间 (0 表示年终奖)']
    );
  }
});

test('validateSalary 覆盖金额字段非法错误', () => {
  assertValidationError(
    () => validateSalary({ year: 2024, month: 1, baseSalary: 'abc' }),
    ['数值格式不正确']
  );
  assertValidationError(
    () => validateSalary({ year: 2024, month: 1, netPay: Infinity }),
    ['数值格式不正确']
  );
});

test('validateLedger 成功规范化账本请求与标签', () => {
  assert.deepEqual(
    validateLedger({
      type: 'INCOME',
      amount: '12.34',
      entryDate: '2024-02-29',
      tags: ['工资', null, undefined, 456],
      remark: '二月工资',
    }),
    {
      type: 'INCOME',
      amount: 12.34,
      entryDate: '2024-02-29',
      tags: ['工资', '', '', '456'],
      remark: '二月工资',
    }
  );
  assert.deepEqual(validateLedger({ type: 'EXPENSE', amount: 1, entryDate: '2024-01-01' }), {
    type: 'EXPENSE',
    amount: 1,
    entryDate: '2024-01-01',
    tags: [],
    remark: null,
  });
});

test('validateLedger 覆盖类型、金额、日期与标签错误', () => {
  assertValidationError(
    () => validateLedger({ type: null, amount: 1, entryDate: '2024-01-01' }),
    ['收支类型不能为空']
  );
  assertValidationError(
    () => validateLedger({ type: undefined, amount: 1, entryDate: '2024-01-01' }),
    ['收支类型不能为空']
  );
  for (const amount of [null, undefined, '']) {
    assertValidationError(
      () => validateLedger({ type: 'INCOME', amount, entryDate: '2024-01-01' }),
      ['金额不能为空']
    );
  }
  for (const amount of ['abc', 0, 0.009]) {
    assertValidationError(
      () => validateLedger({ type: 'INCOME', amount, entryDate: '2024-01-01' }),
      ['金额需大于 0']
    );
  }
  assertValidationError(
    () => validateLedger({ type: 'INCOME', amount: 1, entryDate: ' ' }),
    ['发生日期不能为空']
  );
  assertValidationError(
    () => validateLedger({ type: 'INCOME', amount: 1, entryDate: '2024-02-30' }),
    ['发生日期格式不正确']
  );
  assertValidationError(
    () => validateLedger({ type: 'INCOME', amount: 1, entryDate: '2024-01-01', tags: '标签' }),
    ['标签格式不正确']
  );
});

test('validateUpdateUser 成功规范化 enabled 的所有合法分支', () => {
  assert.deepEqual(validateUpdateUser({ nickname: '用户', email: 'u@example.test' }), {
    nickname: '用户',
    email: 'u@example.test',
    role: null,
    enabled: null,
    password: null,
  });
  assert.equal(validateUpdateUser({ enabled: null }).enabled, null);
  assert.equal(validateUpdateUser({ enabled: true }).enabled, true);
  assert.equal(validateUpdateUser({ enabled: false }).enabled, false);
  assert.equal(validateUpdateUser({ enabled: 'true' }).enabled, true);
  assert.equal(validateUpdateUser({ enabled: 'false' }).enabled, false);
});

test('validateUpdateUser 覆盖资料、密码和 enabled 错误', () => {
  assertValidationError(
    () =>
      validateUpdateUser({
        nickname: repeat('昵', 65),
        email: repeat('e', 129),
        password: repeat('p', 65),
        enabled: 'yes',
      }),
    ['昵称过长', '邮箱过长', '密码过长', '状态格式不正确']
  );
});

test('validateUpdateLog 成功规范化日志更新并覆盖长度错误', () => {
  assert.deepEqual(validateUpdateLog({ module: '用户', operation: '创建用户' }), {
    module: '用户',
    operation: '创建用户',
  });
  assert.deepEqual(validateUpdateLog(), { module: null, operation: null });
  assertValidationError(
    () => validateUpdateLog({ module: repeat('m', 65), operation: repeat('o', 257) }),
    ['模块名称过长', '操作描述过长']
  );
});

test('validateUpdateRolePermission 成功处理空页面列表与数组元素', () => {
  assert.deepEqual(validateUpdateRolePermission(), { pages: null });
  assert.deepEqual(validateUpdateRolePermission({ pages: null }), { pages: null });
  assert.deepEqual(validateUpdateRolePermission({ pages: ['salary', null, undefined, ''] }), {
    pages: ['salary', '', '', ''],
  });
});

test('validateUpdateRolePermission 覆盖页面列表格式错误', () => {
  assertValidationError(
    () => validateUpdateRolePermission({ pages: 'salary' }),
    ['页面列表格式不正确']
  );
});
