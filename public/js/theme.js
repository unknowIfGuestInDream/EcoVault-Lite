/**
 * @file 主题切换脚本。
 *
 * 读取并持久化用户偏好的明暗主题，并绑定切换按钮。
 */
(function () {
  var KEY = 'ecovault-theme';
  var root = document.documentElement;
  var saved = window.localStorage.getItem(KEY);
  if (saved === 'dark' || saved === 'light') {
    root.setAttribute('data-theme', saved);
  }
  var toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      window.localStorage.setItem(KEY, next);
    });
  }
})();
