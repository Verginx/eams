// EAMS 忘记密码页逻辑 — 单表单：用户名 → 新密码 → 确认新密码 → 确认重置 / 取消

// ===== 密码强度实时展示 =====

/** 返回密码规则清单 */
function getPwdChecks(pwd) {
    return [
        { key: 'length',  label: '至少 8 个字符',              test: pwd.length >= 8 },
        { key: 'upper',   label: '至少包含一个大写字母 (A-Z)', test: /[A-Z]/.test(pwd) },
        { key: 'lower',   label: '至少包含一个小写字母 (a-z)', test: /[a-z]/.test(pwd) },
        { key: 'digit',   label: '至少包含一个数字 (0-9)',     test: /[0-9]/.test(pwd) },
        { key: 'special', label: '至少包含一个特殊字符 (!@#$%…)', test: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]/.test(pwd) },
    ];
}

/** 密码是否满足全部强度规则 */
function pwdMeetsRules(pwd) {
    return getPwdChecks(pwd).every(c => c.test);
}

/** 确认密码是否已填写且与新密码一致 */
function confirmMatches() {
    const newPwd = document.getElementById('newPassword').value;
    const confirmPwd = document.getElementById('confirmPassword').value;
    return confirmPwd !== '' && confirmPwd === newPwd;
}

/** 联动刷新确认按钮可用状态 */
function refreshResetBtn() {
    document.getElementById('resetBtn').disabled =
        !pwdMeetsRules(document.getElementById('newPassword').value) || !confirmMatches();
}

/** 新密码输入时实时更新强度条和规则清单 */
function updateStrength() {
    const pwd = document.getElementById('newPassword').value;
    const bar = document.getElementById('strengthBar');
    const text = document.getElementById('strengthText');
    const rules = document.getElementById('strengthRules');

    const checks = getPwdChecks(pwd);
    const met = checks.filter(c => c.test).length;

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

    refreshResetBtn();
}

/** 确认新密码输入时实时提示是否一致 */
function updateConfirm() {
    const hint = document.getElementById('confirmHint');
    const confirmPwd = document.getElementById('confirmPassword').value;
    if (!confirmPwd) {
        hint.textContent = '';
    } else {
        const ok = confirmMatches();
        hint.textContent = ok ? '两次密码输入一致' : '两次输入的密码不一致';
        hint.style.color = ok ? '#52c41a' : '#ff4d4f';
    }
    refreshResetBtn();
}

// ===== 取消 =====

/** 取消：返回登录页 */
function cancelReset() {
    location.href = '/static/login.html';
}

// ===== 提交重置 =====

/**
 * 校验并提交重置密码
 * 调用 /auth/reset-password（后端已校验用户名存在性与密码强度），成功后跳转登录页
 */
async function resetPassword() {
    const username = document.getElementById('username').value.trim();
    const newPwd = document.getElementById('newPassword').value;
    const confirmPwd = document.getElementById('confirmPassword').value;
    const msg = document.getElementById('msg');
    msg.style.color = '#ff4d4f';

    // 用户名
    if (!username) { msg.textContent = '请输入用户名'; return; }
    if (username.length < 3 || username.length > 20) {
        msg.textContent = '用户名需 3-20 位'; return;
    }
    // 新密码
    if (!newPwd) { msg.textContent = '请输入新密码'; return; }
    if (newPwd.length < 8 || newPwd.length > 30) {
        msg.textContent = '密码长度为 8-30 位'; return;
    }
    if (!pwdMeetsRules(newPwd)) {
        msg.textContent = '密码不符合强度要求，请检查规则清单'; return;
    }
    // 确认密码
    if (newPwd !== confirmPwd) { msg.textContent = '两次输入的密码不一致'; return; }

    msg.textContent = '';
    try {
        const resp = await fetch('/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, new_password: newPwd })
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

// ===== 回车键快捷操作 =====
document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') resetPassword();
});
