// EAMS 忘记密码页逻辑 — 三步式：验证用户名 → 设置新密码 → 确认新密码

/** 当前已验证通过的用户名（步骤间传递） */
let verifiedUsername = '';

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

/** 新密码输入时实时更新强度条和规则清单 */
function updateStrength() {
    const pwd = document.getElementById('newPassword').value;
    const bar = document.getElementById('strengthBar');
    const text = document.getElementById('strengthText');
    const rules = document.getElementById('strengthRules');
    const btn = document.getElementById('next2Btn');

    const checks = getPwdChecks(pwd);
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

    // 不符合全部规则时禁用下一步按钮
    btn.disabled = !allMet;
}

/** 确认新密码输入时实时提示是否一致 */
function updateConfirm() {
    const newPwd = document.getElementById('newPassword').value;
    const confirmPwd = document.getElementById('confirmPassword').value;
    const hint = document.getElementById('confirmHint');
    const btn = document.getElementById('resetBtn');

    if (!confirmPwd) {
        hint.textContent = '';
        btn.disabled = true;
        return;
    }
    const ok = confirmPwd === newPwd;
    hint.textContent = ok ? '两次密码输入一致' : '两次输入的密码不一致';
    hint.style.color = ok ? '#52c41a' : '#ff4d4f';
    btn.disabled = !ok;
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
            document.getElementById('newPassword').focus();
        } else {
            msg.textContent = json.msg || '用户名验证失败';
        }
    } catch (e) {
        msg.textContent = '网络错误，请重试';
    }
}

// ===== 步骤二：校验新密码并进入确认步骤 =====

/**
 * 校验新密码长度与强度，通过后进入步骤三（确认密码）
 */
function goToStep3() {
    const newPwd = document.getElementById('newPassword').value;
    const msg = document.getElementById('msg');
    msg.style.color = '#ff4d4f';

    if (!newPwd) { msg.textContent = '请输入新密码'; return; }
    if (newPwd.length < 8 || newPwd.length > 30) {
        msg.textContent = '密码长度为 8-30 位'; return;
    }
    const checks = getPwdChecks(newPwd);
    if (checks.some(c => !c.test)) {
        msg.textContent = '密码不符合强度要求，请检查规则清单'; return;
    }

    msg.textContent = '';
    const confirm = document.getElementById('confirmPassword');
    confirm.value = '';
    document.getElementById('confirmHint').textContent = '';
    document.getElementById('resetBtn').disabled = true;
    switchStep(3);
    confirm.focus();
}

// ===== 步骤三：确认密码并重置 =====

/**
 * 提交新密码
 * 调用 /auth/reset-password，成功后跳转登录页
 */
async function resetPassword() {
    const newPwd = document.getElementById('newPassword').value;
    const confirmPwd = document.getElementById('confirmPassword').value;
    const msg = document.getElementById('msg');
    msg.style.color = '#ff4d4f';

    // 非空与一致性校验
    if (!newPwd) { msg.textContent = '请先返回上一步设置新密码'; return; }
    if (newPwd !== confirmPwd) { msg.textContent = '两次输入的密码不一致'; return; }

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

/** 切换到指定步骤（1 / 2 / 3） */
function switchStep(n) {
    document.getElementById('step1').classList.toggle('active', n === 1);
    document.getElementById('step2').classList.toggle('active', n === 2);
    document.getElementById('step3').classList.toggle('active', n === 3);
}

/** 返回上一步（从当前步骤退回一级） */
function goBack() {
    document.getElementById('msg').textContent = '';
    document.getElementById('msg').style.color = '#ff4d4f';
    if (document.getElementById('step3').classList.contains('active')) {
        switchStep(2);
    } else {
        switchStep(1);
    }
}

// ===== 回车键快捷操作 =====
document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    if (document.getElementById('step1').classList.contains('active')) {
        checkUsername();
    } else if (document.getElementById('step2').classList.contains('active')) {
        goToStep3();
    } else {
        resetPassword();
    }
});
