/**
 * @file 控制台页交互脚本。
 *
 * 绑定退出登录动作，退出后返回登录页。
 */
(function () {
  var logout = document.getElementById('logout-btn');
  if (logout) {
    logout.addEventListener('click', async function () {
      try {
        await window.EcoVaultApi.post('/api/auth/logout', {});
      } catch (_error) {
        // 退出接口失败也不阻塞跳转，直接返回登录页。
      }
      window.location.assign('/login');
    });
  }
})();
