/**
 * @file 前端 API 客户端。
 *
 * 统一封装 fetch 调用：自动附加双重提交 CSRF 头、解析统一响应
 * `{ code, message, data }`，并在业务失败时抛出可读错误。
 */
(function () {
  /**
   * 读取指定名称的 Cookie 值。
   *
   * @param {string} name - Cookie 名称。
   * @returns {string} Cookie 值（不存在时为空串）。
   */
  function readCookie(name) {
    var target = name + '=';
    var parts = document.cookie ? document.cookie.split('; ') : [];
    for (var i = 0; i < parts.length; i += 1) {
      if (parts[i].indexOf(target) === 0) {
        return decodeURIComponent(parts[i].slice(target.length));
      }
    }
    return '';
  }

  /**
   * 发起一次 API 请求。
   *
   * @param {string} method - HTTP 方法。
   * @param {string} url - 请求地址。
   * @param {object} [body] - 可选 JSON 请求体。
   * @returns {Promise<*>} 解析后的响应数据。
   */
  async function request(method, url, body) {
    var headers = { 'Content-Type': 'application/json' };
    var csrf = readCookie('XSRF-TOKEN');
    if (csrf) {
      headers['X-XSRF-TOKEN'] = csrf;
    }
    var options = { method: method, headers: headers, credentials: 'same-origin' };
    if (body !== undefined && body !== null) {
      options.body = JSON.stringify(body);
    }
    var response = await window.fetch(url, options);
    var payload;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!payload || payload.code !== 0) {
      throw new Error(payload && payload.message ? payload.message : '请求失败');
    }
    return payload.data;
  }

  window.EcoVaultApi = {
    request: request,
    get: function (url) {
      return request('GET', url);
    },
    post: function (url, body) {
      return request('POST', url, body);
    },
    put: function (url, body) {
      return request('PUT', url, body);
    },
    del: function (url) {
      return request('DELETE', url);
    },
    readCookie: readCookie,
  };
})();
