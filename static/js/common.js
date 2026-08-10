// EAMS 公共前端逻辑：统一请求封装 + 退出
// 供 dashboard.html 共用，保证所有接口请求的错误处理一致

// ===== 通用请求封装 =====
/**
 * 统一 API 请求封装：解析 {code,msg,data} envelope、统一错误处理
 * @param {string} url   请求路径（如 '/students/page'）
 * @param {string} method HTTP 方法（默认 GET）
 * @param {object} body   请求体对象（可选，自动 JSON 序列化）
 * @returns {Promise<any>} 成功返回 data 字段；失败返回空数组 []
 */
async function api(url, method='GET', body=null) {
    // 构造请求选项，默认空 headers
    const opt = { method, headers: {} };
    // 有请求体时声明 JSON 并序列化
    if (body) opt.headers['Content-Type'] = 'application/json';
    if (body) opt.body = JSON.stringify(body);

    // 发起请求并解析 JSON（后端统一返回 {code, msg, data}）
    const resp = await fetch(url, opt);
    const json = await resp.json();

    // code===0 表示成功，返回业务数据
    if (json.code === 0) return json.data;
    // 其它错误：提示后端 msg（如 400 业务校验、404、422 参数校验、500）
    alert(json.msg || '操作失败');
    return [];
}

// ===== HTML 转义 =====
/**
 * HTML 转义：防止用户输入（姓名/课程名等）注入到 innerHTML 造成 XSS
 * @param {*} str 任意值（null/undefined 转为空串）
 * @returns {string} 转义后的安全字符串
 */
function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

// ===== 退出 =====
/**
 * 退出登录：清空 localStorage 中的登录信息
 */
function logout() { localStorage.clear(); }
