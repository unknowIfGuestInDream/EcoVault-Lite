import process from 'node:process';
import config from './config/index.js';
import db from './db/index.js';
import { createContext } from './context.js';
import { initializeData } from './bootstrap/dataInitializer.js';
import { buildApp } from './app.js';

/**
 * @file 服务入口。
 *
 * 装配数据库、上下文与应用实例，完成基础数据初始化后开始监听。
 */

/**
 * 启动 HTTP 服务。
 *
 * @returns {Promise<void>} 启动完成的 Promise。
 */
async function start() {
  const context = createContext(db);
  initializeData(context);
  const app = await buildApp(context, { logger: { level: config.log.level } });
  await app.listen({ port: config.port, host: config.host });
}

start().catch((error) => {
  // 启动失败时输出原因并以非零码退出，便于部署脚本感知。
  console.error(error);
  process.exit(1);
});
