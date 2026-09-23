import { MENU_PAGES, getMenuPage } from '../domain/menuPage.js';
import { sanitizeUser } from './support.js';

/**
 * @file 页面路由（服务端渲染）。
 *
 * 渲染登录页、错误页与应用主框架。菜单与页面访问按当前用户的
 * 角色权限动态裁剪；无权访问的可配置页面会重定向回控制台。
 */

/**
 * 注册页面路由。
 *
 * @param {object} app - Fastify 实例。
 * @param {AppContext} context - 应用上下文。
 * @returns {void}
 */
export function registerPageRoutes(app, context) {
  const { rolePermissionService } = context.services;

  app.get('/', async (request, reply) => reply.redirect('/dashboard'));

  app.get('/login', async (request, reply) => reply.view('login.ejs', { title: '登录' }));

  app.get('/error', async (request, reply) =>
    reply.view('error.ejs', { title: '出错了', message: '请求出现错误' })
  );

  for (const page of MENU_PAGES) {
    app.get(page.path, async (request, reply) => {
      if (!rolePermissionService.canAccessPath(request.user, page.path)) {
        return reply.redirect('/dashboard');
      }
      const menu = rolePermissionService
        .accessiblePageKeys(request.user)
        .map((key) => getMenuPage(key))
        .filter(Boolean);
      return reply.view('dashboard.ejs', {
        title: page.title,
        active: page.key,
        menu,
        user: sanitizeUser(request.user),
      });
    });
  }
}

export default registerPageRoutes;
