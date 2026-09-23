/**
 * @file 日期时间格式化工具测试。
 */
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDate,
  formatDateTime,
  isValidDate,
  nowDateTime,
} from '../../../src/utils/datetime.js';

beforeEach(() => {
  delete process.env.ECOVAULT_TZ_OFFSET_MINUTES;
});

function runDatetimeSnippet(envOverrides) {
  const script = `
    import { formatDate, formatDateTime } from './src/utils/datetime.js';
    const date = new Date('2024-01-01T00:00:05.000Z');
    console.log(JSON.stringify({
      date: formatDate(date),
      dateTime: formatDateTime(date)
    }));
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: process.cwd(),
    env: { ...process.env, ...envOverrides },
    encoding: 'utf8',
  });
  return JSON.parse(output);
}

test('formatDateTime 与 formatDate 按默认东八区格式化固定时间', () => {
  const date = new Date('2024-01-01T00:00:05.000Z');
  const crossDay = new Date('2023-12-31T20:00:00.000Z');

  assert.equal(formatDateTime(date), '2024-01-01 08:00:05');
  assert.equal(formatDate(date), '2024-01-01');
  assert.equal(formatDateTime(crossDay), '2024-01-01 04:00:00');
  assert.equal(formatDate(crossDay), '2024-01-01');
});

test('默认参数可格式化当前日期时间', () => {
  assert.match(formatDateTime(), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.match(formatDate(), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(nowDateTime(), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});

test('isValidDate 识别有效日期、格式错误和越界日期', () => {
  assert.equal(isValidDate('2024-02-29'), true);
  assert.equal(isValidDate('0100-01-01'), true);
  assert.equal(isValidDate(20240101), false);
  assert.equal(isValidDate('2024-2-29'), false);
  assert.equal(isValidDate('2024-00-10'), false);
  assert.equal(isValidDate('2024-13-10'), false);
  assert.equal(isValidDate('2024-01-00'), false);
  assert.equal(isValidDate('2024-01-32'), false);
  assert.equal(isValidDate('0000-01-01'), false);
  assert.equal(isValidDate('2023-02-29'), false);
  assert.equal(isValidDate('2024-04-31'), false);
});

test('子进程覆盖时区偏移环境变量的有效值与非法回退', () => {
  assert.deepEqual(runDatetimeSnippet({ ECOVAULT_TZ_OFFSET_MINUTES: '0' }), {
    date: '2024-01-01',
    dateTime: '2024-01-01 00:00:05',
  });
  assert.deepEqual(runDatetimeSnippet({ ECOVAULT_TZ_OFFSET_MINUTES: 'invalid' }), {
    date: '2024-01-01',
    dateTime: '2024-01-01 08:00:05',
  });
});
