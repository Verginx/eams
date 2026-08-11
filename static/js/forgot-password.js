// EAMS 忘记密码页逻辑 — 两步式：验证用户名 → 设置新密码

/** 当前已验证通过的用户名（步骤间传递） */
let verifiedUsername = '';

// ===== 密码强度实时展示 =====

/**
 * 密码输入时实时更新强度条和规则清单
 * 策略：前端本地判断 + 后端接口确认（以本地为主，快速反馈）
 */
function updateStrength() {
    const pwd = document.getElementById('newPassword').value;
    const bar = document.getElementById('strengthBar');
    const text = document.getElementById('strengthText');
    const rules = document.getElementById('strengthRules');
    const btn = document.getElementById('resetBtn');

    // 规则清单
    const checks = [
        { key: 'length',  label: '至少 8 个字符',          test: pwd.length >= 8 },
        { key: 'upper',  label: '至少包含一个大写字母 (A-Z)', test: /[A-Z]/.test(pwd) },
        { key: 'lower',  label: '至少包含一个小写字母 (a-z)', test: /[a-z]/.test(pwd) },
        { key: 'digit',  label: '至少包含一个数字 (0-9)',    test: /[0-9]/.test(pwd) },
        { key: 'special', label: '至少包含一个特殊字符 (!@#$%…)', test: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]/.test(pwd) },
    ];

    // 通过规则数
    const met = checks.filter(c => c.test).length;
    const allMet = met === checks.length;

    // 强度条：去除旧 level 类，追加新 level 类
    bar.className = 'pwd-strength-bar level-' + met;

    // 强度文字
    const labels = { 0: '#ff4d4f', 1: '#ff4d4f', 2: '#fa8c16', 3: '#1890ff', 4: '#52c41a', 5: '#52c41a' };
    const names  = { 0: '弱', 1: '弱', 2: '一般', 3: '中等', 4: '强', 5: '很强' };
    text.innerHTML = '密码强度：<span style="color:' + labels[met] + '">' + names[met] + '</span>';

    // 规则清单 HTML
    rules.innerHTML = checks.map(c =>
        '<div class="rule' + (c.test ? ' met' : '') + '">' +
        '<span class="icon">' + (c.test ? '✓' : '✗') + '</span>' +
        c.label +
        '</div>'
    ).join('');

    // 不符合全部规则时禁用按钮
    btn.disabled = !allMet;
}

// ===== 步骤一：验证用户名 =====

/**
 * 检查用户名是否存在
 * 调用 /auth/check-username，成功则进入步骤二
 */
async function checkUsername() {
    const username = document.getElementById('username').value.trim();
    const msg = document.getElementById('msg');

    if (!username) { msg.textContent = '请输入用户名'; return; }
    if (username.length < 3 || username.length > 20) {
        msg.textContent = '用户名需 3-20 位'; return;
    }

    msg.textContent = '';
    try {
        const resp = await fetch('/auth/check-username', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const json = await resp.json();

        if (json.code === 0) {
            // 验证通过，保存用户名并切换到步骤二
            verifiedUsername = username;
            msg.style.color = '#52c41a';
            msg.textContent = '';
            switchStep(2);
        } else {
            msg.textContent = json.msg || '用户名验证失败';
        }
    } catch (e) {
        msg.textContent = '网络错误，请重试';
    }
}

// ===== 步骤二：重置密码 =====

/**
 * 提交新密码
 * 调用 /auth/reset-password，成功后跳转登录页
 */
async function resetPassword() {
    const newPwd = document.getElementById('newPassword').value;
    const confirmPwd = document.getElementById('confirmPassword').value;
    const msg = document.getElementById('msg');
    msg.style.color = '#ff4d4f';

    // 非空校验
    if (!newPwd) { msg.textContent = '请输入新密码'; return; }
    if (newPwd !== confirmPwd) { msg.textContent = '两次输入的密码不一致'; return; }

    // 长度校验
    if (newPwd.length < 8 || newPwd.length > 30) {
        msg.textContent = '密码长度为 8-30 位'; return;
    }

    // 强度校验（本地二次确认）
    if (!/[A-Z]/.test(newPwd)) { msg.textContent = '密码必须包含至少一个大写字母'; return; }
    if (!/[a-z]/.test(newPwd)) { msg.textContent = '密码必须包含至少一个小写字母'; return; }
    if (!/[0-9]/.test(newPwd)) { msg.textContent = '密码必须包含至少一个数字'; return; }
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]/.test(newPwd)) {
        msg.textContent = '密码必须包含至少一个特殊字符'; return;
    }

    msg.textContent = '';
    try {
        const resp = await fetch('/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: verifiedUsername, new_password: newPwd })
        });
        const json = await resp.json();

        if (json.code === 0) {
            msg.style.color = '#52c41a';
            msg.textContent = json.msg + '，即将跳转登录页...';
            setTimeout(() => location.href = '/static/login.html', 1000);
        } else {
            msg.textContent = json.msg || '密码重置失败';
        }
    } catch (e) {
        msg.textContent = '网络错误，请重试';
    }
}

// ===== 步骤切换 =====

/** 切换到指定步骤（1 或 2） */
function switchStep(n) {
    document.getElementById('step1').classList.toggle('active', n === 1);
    document.getElementById('step2').classList.toggle('active', n === 2);
}

/** 返回上一步 */
function goBack() {
    document.getElementById('msg').textContent = '';
    document.getElementById('msg').style.color = '#ff4d4f';
    switchStep(1);
}

// ===== 回车键快捷操作 =====
document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    if (document.getElementById('step1').classList.contains('active')) {
        checkUsername();
    } else {
        resetPassword();
    }
});
