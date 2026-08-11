// EAMS 注册页逻辑

/**
 * 学生注册：前端校验 → 调用 /auth/register → 成功后跳转登录页
 * 校验规则与后端 auth/vo.py 的 RegisterRequest 保持一致：
 * 用户名 3-20 位、密码 8-30 位且含大小写字母+数字+特殊字符、姓名必填、年龄 10-100
 */

// 密码强度条：输入时实时调用后端 /auth/password-strength 评估并渲染
async function checkStrength() {
    const password = document.getElementById('password').value;
    const fill = document.getElementById('strengthFill');
    const label = document.getElementById('strengthLabel');
    if (!fill || !label) return;
    if (!password) { fill.style.width = '0%'; label.textContent = ''; return; }
    // 调用后端强度评估接口（返回 {level, label, color, percent, valid}）
    const resp = await fetch('/auth/password-strength', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
    });
    const json = await resp.json();
    if (json.code === 0) {
        fill.style.width = json.data.percent + '%';
        fill.style.background = json.data.color;
        label.textContent = json.data.label + (json.data.valid ? '（符合要求）' : '（不符合要求）');
    }
}

/**
 * 注册提交：前端校验 → POST /auth/register → 成功跳转登录
 * 密码规则与后端 validate_password_strength 保持一致
 */
async function register() {
    // 读取表单各字段（文本类去首尾空格）
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const name = document.getElementById('name').value.trim();
    const gender = document.getElementById('gender').value;
    const ageInput = document.getElementById('age').value;
    const msg = document.getElementById('msg');

    // ---- 前端校验（防 422 误报，规则与后端一致） ----
    if (username.length < 3 || username.length > 20) { alert('用户名需 3-20 位'); return; }
    if (!/^.{8,30}$/.test(password)) { alert('密码需 8-30 位'); return; }
    if (!/[A-Z]/.test(password)) { alert('密码必须包含至少一个大写字母'); return; }
    if (!/[a-z]/.test(password)) { alert('密码必须包含至少一个小写字母'); return; }
    if (!/[0-9]/.test(password)) { alert('密码必须包含至少一个数字'); return; }
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]/.test(password)) { alert('密码必须包含至少一个特殊字符（如 !@#$% 等）'); return; }
    if (!name) { alert('请填写真实姓名'); return; }
    const age = Number(ageInput);
    if (!ageInput || isNaN(age) || age < 10 || age > 100) {
        alert('年龄需为 10-100 之间的数字'); return;
    }

    // 组装注册请求体
    const body = { username, password, name, gender, age };

    // 调用注册接口（公开接口，无需登录）
    const resp = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const json = await resp.json();

    if (json.code === 0) {
        // 注册成功：绿色提示并稍后跳转登录页
        msg.style.color = '#52c41a';
        msg.textContent = json.msg + '，请登录';
        setTimeout(() => location.href = '/static/login.html', 800);
    } else {
        // 注册失败（如用户名已存在），红色提示后端 msg
        msg.style.color = '#ff4d4f';
        msg.textContent = json.msg || '注册失败';
    }
}
