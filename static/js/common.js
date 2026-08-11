// EAMS 公共前端逻辑：统一请求封装 + 退出
// 供 dashboard.html 共用，保证所有接口请求的错误处理一致

// ===== 当前登录信息（localStorage，登录时由 login.js 写入） =====
const currentUser = localStorage.getItem('username') || '';
const currentRole = localStorage.getItem('role') || 'student';

// ===== 通用请求封装 =====
/**
 * 统一 API 请求封装：解析 {code,msg,data} envelope、统一错误处理
 * 自动携带 X-Current-User / X-Current-Role 请求头（供后端记录操作人与回收站鉴权）
 * @param {string} url     请求路径（如 '/students/page'）
 * @param {string} method  HTTP 方法（默认 GET）
 * @param {object} body    请求体对象（可选，自动 JSON 序列化）
 * @param {object} extraHeaders 附加请求头（可选，如 { 'X-Current-Role': 'admin' }）
 * @returns {Promise<any>} 成功返回 data 字段；失败/网络异常返回 null（调用方需判空）
 */
async function api(url, method='GET', body=null, extraHeaders=null) {
    // 构造请求选项，携带当前用户/角色头
    const opt = { method, headers: { 'X-Current-User': currentUser, 'X-Current-Role': currentRole } };
    // 有请求体时声明 JSON 并序列化
    if (body) opt.headers['Content-Type'] = 'application/json';
    if (body) opt.body = JSON.stringify(body);
    // 合并附加请求头（覆盖默认）
    if (extraHeaders) Object.assign(opt.headers, extraHeaders);

    // 发起请求：网络层异常（断网/超时）需捕获，避免未处理 Promise rejection
    let resp;
    try {
        resp = await fetch(url, opt);
    } catch (e) {
        showToast('网络请求失败，请检查网络连接后重试', 'error');
        return null;
    }

    // 解析 JSON：非 JSON 响应（如 502 网关错误）也需兜底
    let json;
    try {
        json = await resp.json();
    } catch (e) {
        showToast('服务器响应异常，请稍后重试', 'error');
        return null;
    }

    // code===0 表示成功，返回业务数据
    if (json.code === 0) return json.data;
    // 其它错误：提示后端 msg（如 400 业务校验、404、422 参数校验、500）
    showToast(json.msg || '操作失败', 'error');
    return null;
}

// ===== Toast 轻提示 =====
/**
 * 轻量 Toast 提示：右上角浮现，2.5 秒后自动消失
 * 替代 alert() 用于非阻塞的成功/失败/信息提示
 * @param {string} msg  提示文本
 * @param {string} type 类型：success / error / info（默认 info）
 */
function showToast(msg, type='info') {
    let box = document.getElementById('toastBox');
    if (!box) {
        box = document.createElement('div');
        box.id = 'toastBox';
        box.className = 'toast-box';
        document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.className = 'toast toast-' + (type || 'info');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => {
        t.classList.add('toast-hide');
        setTimeout(() => t.remove(), 300);
    }, 2500);
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
