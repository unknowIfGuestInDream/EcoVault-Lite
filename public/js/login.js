/**
 * @file 登录页交互脚本。
 *
 * 提交登录表单，成功后跳转控制台，失败时在表单内提示错误。
 */
(function () {
  var form = document.getElementById('login-form');
  if (!form) {
    return;
  }
  var errorEl = document.getElementById('login-error');
  var submit = document.getElementById('login-submit');

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    errorEl.hidden = true;
    var username = document.getElementById('login-username').value.trim();
    var password = document.getElementById('login-password').value;
    submit.disabled = true;
    try {
      await window.EcoVaultApi.post('/api/auth/login', { username: username, password: password });
      window.location.assign('/dashboard');
    } catch (error) {
      errorEl.textContent = error.message;
      errorEl.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });
})();
