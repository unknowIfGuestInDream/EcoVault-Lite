/**
 * @file 应用配置加载测试。
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

const CONFIG_ENV_KEYS = [
  'NODE_ENV',
  'ECOVAULT_PORT',
  'ECOVAULT_HOST',
  'ECOVAULT_DB_PATH',
  'ECOVAULT_JWT_SECRET',
  'ECOVAULT_JWT_EXPIRATION_MS',
  'ECOVAULT_MAX_DEVICES',
  'ECOVAULT_CRYPTO_SECRET',
  'ECOVAULT_ADMIN_USERNAME',
  'ECOVAULT_ADMIN_PASSWORD',
  'ECOVAULT_APP_LOG_LEVEL',
];

beforeEach(() => {
  for (const key of CONFIG_ENV_KEYS) {
    delete process.env[key];
  }
});

function loadConfig(envOverrides = {}) {
  const env = { ...process.env };
  for (const key of CONFIG_ENV_KEYS) {
    delete env[key];
  }
  Object.assign(env, envOverrides);

  const script = `
    import config from './src/config/index.js';
    console.log(JSON.stringify({
      config,
      frozen: Object.isFrozen(config),
      nestedFrozen: {
        db: Object.isFrozen(config.db),
        jwt: Object.isFrozen(config.jwt),
        crypto: Object.isFrozen(config.crypto),
        admin: Object.isFrozen(config.admin),
        log: Object.isFrozen(config.log)
      }
    }));
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
  });
  return JSON.parse(output);
}

test('默认配置使用开发环境与文件数据库路径', () => {
  const { config, frozen, nestedFrozen } = loadConfig();
  const rootDir = path.resolve(process.cwd());

  assert.equal(frozen, true);
  assert.deepEqual(nestedFrozen, {
    db: true,
    jwt: true,
    crypto: true,
    admin: true,
    log: true,
  });
  assert.equal(config.env, 'development');
  assert.equal(config.isProduction, false);
  assert.equal(config.port, 8100);
  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.rootDir, rootDir);
  assert.equal(config.db.path, path.resolve(rootDir, 'data/ecovault.db'));
  assert.equal(
    config.jwt.secret,
    'Zm9vYmFyLWVjb3ZhdWx0LXNlY3JldC1rZXktY2hhbmdlLW1lLTEyMzQ1Njc4OTA='
  );
  assert.equal(config.jwt.expirationMs, 7200000);
  assert.equal(config.jwt.maxDevices, 1);
  assert.equal(config.jwt.cookieName, 'ECOVAULT_TOKEN');
  assert.equal(config.crypto.secret, 'ecovault-aes-secret-change-me-32b');
  assert.deepEqual(config.admin, { username: 'admin', password: 'Admin@123' });
  assert.deepEqual(config.log, { level: 'info' });
});

test('自定义环境变量覆盖全部可配置项并识别生产环境', () => {
  const { config } = loadConfig({
    NODE_ENV: 'production',
    ECOVAULT_PORT: '9100',
    ECOVAULT_HOST: '127.0.0.1',
    ECOVAULT_DB_PATH: 'runtime/custom.db',
    ECOVAULT_JWT_SECRET: 'custom-jwt-secret',
    ECOVAULT_JWT_EXPIRATION_MS: '12345',
    ECOVAULT_MAX_DEVICES: '3',
    ECOVAULT_CRYPTO_SECRET: 'custom-crypto-secret',
    ECOVAULT_ADMIN_USERNAME: 'root',
    ECOVAULT_ADMIN_PASSWORD: 'Root@123456',
    ECOVAULT_APP_LOG_LEVEL: 'debug',
  });

  assert.equal(config.env, 'production');
  assert.equal(config.isProduction, true);
  assert.equal(config.port, 9100);
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.db.path, path.resolve(process.cwd(), 'runtime/custom.db'));
  assert.equal(config.jwt.secret, 'custom-jwt-secret');
  assert.equal(config.jwt.expirationMs, 12345);
  assert.equal(config.jwt.maxDevices, 3);
  assert.equal(config.crypto.secret, 'custom-crypto-secret');
  assert.deepEqual(config.admin, { username: 'root', password: 'Root@123456' });
  assert.deepEqual(config.log, { level: 'debug' });
});

test(':memory: 数据库路径保持原样', () => {
  const { config } = loadConfig({ ECOVAULT_DB_PATH: ':memory:' });

  assert.equal(config.db.path, ':memory:');
});

test('非法整数配置回退到默认值', () => {
  const { config } = loadConfig({
    NODE_ENV: 'test',
    ECOVAULT_PORT: 'not-a-number',
    ECOVAULT_JWT_EXPIRATION_MS: 'Infinity',
    ECOVAULT_MAX_DEVICES: 'NaN',
  });

  assert.equal(config.env, 'test');
  assert.equal(config.isProduction, false);
  assert.equal(config.port, 8100);
  assert.equal(config.jwt.expirationMs, 7200000);
  assert.equal(config.jwt.maxDevices, 1);
});

test('最大设备数低于下限时被提升为一台', () => {
  const { config } = loadConfig({ ECOVAULT_MAX_DEVICES: '0' });

  assert.equal(config.jwt.maxDevices, 1);
});
