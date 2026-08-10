// EAMS 登录页逻辑

/**
 * 登录：校验输入 → 调用 /auth/login → 保存登录信息并跳转后台
 * 成功响应 data 含：user_id / username / role / student_id
 */
async function login() {
    // 读取输入框（用户名去首尾空格）
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const msg = document.getElementById('msg');

    // 前端非空校验，避免空表单直接请求后端
    if (!username || !password) { alert('请输入用户名和密码'); return; }

    // 调用登录接口
    const resp = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const json = await resp.json();

    if (json.code === 0) {
        const d = json.data;
        // 保存登录信息（教学演示：用户名 + 角色存 localStorage）
        localStorage.setItem('username', d.username);
        localStorage.setItem('role', d.role);
        // 绿色提示并跳转管理后台
        msg.style.color = '#52c41a';
        msg.textContent = json.msg + '，跳转中...';
        setTimeout(() => location.href = '/static/dashboard.html', 500);
    } else {
        // 登录失败（密码错误/用户不存在），红色提示后端 msg
        msg.textContent = json.msg || '登录失败';
    }
}
