import { test } from 'node:test';
import assert from 'node:assert/strict';
import MENU_PAGES, {
  CONFIGURABLE_PAGE_KEYS,
  configurablePages,
  getMenuPage,
  getMenuPageByPath,
  isConfigurablePage,
} from '../../../src/domain/menuPage.js';

/**
 * @file 菜单页面与 RBAC 元数据测试。
 */

test('MENU_PAGES 保持预期顺序与核心元数据', () => {
  assert.deepEqual(
    MENU_PAGES.map((page) => page.key),
    ['dashboard', 'passwords', 'salary', 'ledger', 'profile', 'users', 'logs', 'roles']
  );
  assert.deepEqual(getMenuPage('users'), {
    key: 'users',
    title: '用户管理',
    path: '/admin/users',
    group: 'ADMIN',
    adminOnly: true,
    configurable: false,
  });
  assert.ok(Object.isFrozen(MENU_PAGES[0]));
});

test('getMenuPage 命中时返回页面，未命中时返回 undefined', () => {
  assert.equal(getMenuPage('passwords')?.path, '/passwords');
  assert.equal(getMenuPage('missing'), undefined);
});

test('可配置页面仅包含密码、工资与账本页面', () => {
  assert.deepEqual(CONFIGURABLE_PAGE_KEYS, ['passwords', 'salary', 'ledger']);
  assert.equal(isConfigurablePage('salary'), true);
  assert.equal(isConfigurablePage('dashboard'), false);
  assert.deepEqual(
    configurablePages().map((page) => page.key),
    CONFIGURABLE_PAGE_KEYS
  );
});

test('getMenuPageByPath 命中时返回页面，未命中时返回 undefined', () => {
  assert.equal(getMenuPageByPath('/finance/ledger')?.key, 'ledger');
  assert.equal(getMenuPageByPath('/missing'), undefined);
});
