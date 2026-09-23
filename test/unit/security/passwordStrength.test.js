import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StrengthLevel, evaluate } from '../../../src/security/passwordStrength.js';

/**
 * @file 密码强度评分测试。
 */

test('evaluate 将空值评为 WEAK 且分数为 0', () => {
  assert.deepEqual(evaluate(null), { score: 0, level: StrengthLevel.WEAK });
  assert.deepEqual(evaluate(undefined), { score: 0, level: StrengthLevel.WEAK });
  assert.deepEqual(evaluate(''), { score: 0, level: StrengthLevel.WEAK });
});

test('evaluate 覆盖长度分段与 WEAK 等级', () => {
  assert.deepEqual(evaluate('abcde'), { score: 15, level: StrengthLevel.WEAK });
  assert.deepEqual(evaluate('abcdef'), { score: 25, level: StrengthLevel.WEAK });
});

test('evaluate 覆盖中等长度、大小写分支与 MEDIUM 等级', () => {
  assert.deepEqual(evaluate('abcdefgh'), { score: 40, level: StrengthLevel.MEDIUM });
  assert.deepEqual(evaluate('ABCDEFGHIJKL'), { score: 55, level: StrengthLevel.MEDIUM });
});

test('evaluate 覆盖数字、特殊字符、STRONG 等级与 100 分上限', () => {
  assert.deepEqual(evaluate('Abcdef12'), { score: 70, level: StrengthLevel.STRONG });
  assert.deepEqual(evaluate('Abcdef12!'), { score: 85, level: StrengthLevel.STRONG });
  assert.deepEqual(evaluate('Abcdefghijk1!'), { score: 100, level: StrengthLevel.STRONG });
});
