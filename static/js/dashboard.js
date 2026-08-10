// EAMS 管理后台逻辑
// 依赖：common.js（api / logout / esc），请在 dashboard.js 之前引入
// 注意：所有插入 innerHTML 的用户数据必须经过 esc() 转义，防止 XSS

// ===== 登录信息 =====
// 填充欢迎语与当前用户（无鉴权，直接显示；未登录也可访问）
const username = localStorage.getItem('username') || '';
const role = localStorage.getItem('role') || 'student';
document.getElementById('userInfo').textContent = '当前用户：' + username;
document.getElementById('welcomeTitle').textContent = '欢迎回来，' + username;
document.getElementById('welcomeSub').textContent =
    (role === 'admin' ? '管理员' : '同学') + ' · 这里是 EAMS 学校教务管理系统';

// ===== 菜单切换（侧边栏高亮） =====
/**
 * 切换后台面板：显示对应 panel 并高亮侧边栏菜单项
 * @param {string} name 面板 id（home/students/teachers/courses/classes/zhicheng）
 */
function switchTab(name) {
    // 隐藏所有面板、取消所有菜单高亮
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('active'));
    // 显示目标面板并高亮对应菜单（data-panel 匹配）
    document.getElementById(name).classList.add('active');
    document.querySelector(`.sidebar li[data-panel="${name}"]`).classList.add('active');
}

// ===== 弹框机制 =====
// 弹框确定按钮的回调（由各 openXxx 函数设置）；关闭时清空
let modalOnOk = null;

/**
 * 打开通用弹框：设置标题与内容并显示
 * @param {string} title    弹框标题
 * @param {string} bodyHtml 弹框内容 HTML（表单/下拉等）
 */
function openModal(title, bodyHtml) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modal').style.display = 'flex';
}
/** 关闭弹框并清空确定回调 */
function closeModal() {
    document.getElementById('modal').style.display = 'none';
    modalOnOk = null;
}
// 弹框确定按钮：点击时执行当前 modalOnOk（未设置则无动作）
document.getElementById('modalOk').onclick = () => { if (modalOnOk) modalOnOk(); };

/**
 * 用列表数据填充下拉框
 * @param {string} selectId 下拉框元素 id
 * @param {Array}  list     数据列表
 * @param {string} valueKey option value 对应的字段（如 id）
 * @param {string} textKey  option 文本对应的字段（如 name）
 */
function fillSelect(selectId, list, valueKey, textKey) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = list.map(item => `<option value="${esc(item[valueKey])}">${esc(item[textKey])}</option>`).join('');
}

// ===== 学生管理（分页） =====
let stuPage = 1;             // 学生列表当前页码
const STU_PAGE_SIZE = 10;    // 每页条数（与后端 /students/page 默认一致）

/**
 * 加载学生列表（分页 + 关键字查询）
 * @param {string} keyword 姓名关键字（省略时读输入框 stuKeyword）
 */
async function loadStudents(keyword) {
    // 未显式传 keyword 时读查询输入框
    if (keyword === undefined) keyword = document.getElementById('stuKeyword').value.trim();
    // 调用分页接口（page/page_size/关键字），返回 {total, items}
    const data = await api(`/students/page?keyword=${encodeURIComponent(keyword)}&page=${stuPage}&page_size=${STU_PAGE_SIZE}`);
    const list = data.items || [];
    // 删除后当前页可能为空：回退一页重载
    if (stuPage > 1 && list.length === 0) { stuPage--; loadStudents(keyword); return; }
    const tbody = document.getElementById('studentBody');
    // 渲染学生行（含编辑/分班/选老师/删除操作）
    tbody.innerHTML = list.map(s => `
        <tr>
            <td>${s.id}</td><td>${esc(s.name)}</td><td>${esc(s.gender)}</td>
            <td>${s.age}</td><td>${esc(s.grade)}</td><td>${esc(s.class_name) || '未分班'}</td>
            <td>${esc(s.teacher_name) || '未选老师'}</td><td>${s.course_count || 0}</td>
            <td>
                <button class="btn btn-blue" onclick="openStudentModal('edit', ${s.id})">编辑</button>
                <button class="btn btn-orange" onclick="openAssignClassModal(${s.id})">分班</button>
                <button class="btn btn-green" onclick="openAssignTeacherModal(${s.id})">选老师</button>
                <button class="btn btn-red" onclick="delStudent(${s.id})">删除</button>
            </td>
        </tr>`).join('');
    renderStuPager(data.total || 0);
}
/**
 * 渲染学生分页条（上一页/页码/下一页），单页时禁用边界按钮
 * @param {number} total 总条数
 */
function renderStuPager(total) {
    const totalPages = Math.max(1, Math.ceil(total / STU_PAGE_SIZE));
    document.getElementById('stuPager').innerHTML =
        `<button class="btn" ${stuPage <= 1 ? 'disabled' : ''} onclick="gotoStuPage(${stuPage - 1})">上一页</button>
         <span class="page-info">第 ${stuPage} / ${totalPages} 页（共 ${total} 条）</span>
         <button class="btn" ${stuPage >= totalPages ? 'disabled' : ''} onclick="gotoStuPage(${stuPage + 1})">下一页</button>`;
}
/** 跳转到指定页并重载学生列表 */
function gotoStuPage(p) { stuPage = p; loadStudents(); }
/** 学生查询：回到第 1 页后按关键字加载 */
function searchStudents() { stuPage = 1; loadStudents(document.getElementById('stuKeyword').value.trim()); }
/** 学生重置：清空关键字并回到第 1 页 */
function resetStudents() { document.getElementById('stuKeyword').value = ''; stuPage = 1; loadStudents(); }

/**
 * 打开新增/编辑学生弹框
 * @param {string} mode 'add' 新增 / 'edit' 编辑
 * @param {number} id    编辑时的学生 ID（新增省略）
 */
async function openStudentModal(mode, id) {
    // 编辑模式先拉取学生详情预填
    let prefill = {};
    if (mode === 'edit') prefill = await api(`/students/one/${id}`) || {};
    // 加载班级与教师列表，供新增时的下拉选择
    const [classes, teachers] = await Promise.all([api('/classes/all'), api('/teachers/all')]);
    // 仅新增模式提供班级/教师下拉（编辑只改基本信息）
    const extraFields = mode === 'add' ? `
        <div class="field"><select id="s_classId">
            <option value="">暂不分班</option>
            ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
        </select></div>
        <div class="field"><select id="s_teacherId">
            <option value="">暂不选老师</option>
            ${teachers.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
        </select></div>` : '';
    openModal(mode === 'add' ? '新增学生' : '编辑学生', `
        <div class="field"><input id="s_name" placeholder="姓名" value="${esc(prefill.name)}"></div>
        <div class="field"><select id="s_gender">
            <option value="男" ${prefill.gender === '男' ? 'selected' : ''}>男</option>
            <option value="女" ${prefill.gender === '女' ? 'selected' : ''}>女</option>
        </select></div>
        <div class="field"><input id="s_age" type="number" placeholder="年龄（10-100）" value="${prefill.age ?? ''}"></div>
        <div class="field"><input id="s_grade" placeholder="年级" value="${esc(prefill.grade)}"></div>
        ${extraFields}
    `);
    // 确定回调：前端校验 → 新增(POST)或编辑(PUT) → 关闭并刷新
    modalOnOk = async () => {
        const name = document.getElementById('s_name').value.trim();
        const ageInput = document.getElementById('s_age').value;
        if (!name) { alert('请填写学生姓名'); return; }
        const age = Number(ageInput);
        if (!ageInput || isNaN(age) || age < 10 || age > 100) { alert('年龄需为 10-100 之间的数字'); return; }
        const body = { name, gender: document.getElementById('s_gender').value, age, grade: document.getElementById('s_grade').value.trim() || '高一' };
        if (mode === 'add') {
            // 新增：附带班级/教师（可空）
            body.class_id = Number(document.getElementById('s_classId').value) || null;
            body.teacher_id = Number(document.getElementById('s_teacherId').value) || null;
            await api('/students/add', 'POST', body);
        } else {
            await api(`/students/update/${id}`, 'PUT', body);
        }
        closeModal();
        loadStudents();
    };
}

/**
 * 打开分班弹框：下拉选择班级 → 绑定学生
 * @param {number} id 学生 ID
 */
async function openAssignClassModal(id) {
    const classes = await api('/classes/all');
    openModal('学生分班', `
        <div class="field"><select id="a_class">
            <option value="">请选择班级</option>
            ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
        </select></div>
    `);
    modalOnOk = async () => {
        const class_id = document.getElementById('a_class').value;
        if (!class_id) { alert('请选择班级'); return; }
        await api(`/students/assign-class/${id}`, 'PUT', { class_id: Number(class_id) });
        closeModal();
        loadStudents();
    };
}

/**
 * 打开选老师弹框：下拉选择教师 → 绑定学生
 * @param {number} id 学生 ID
 */
async function openAssignTeacherModal(id) {
    const teachers = await api('/teachers/all');
    openModal('选择老师', `
        <div class="field"><select id="a_teacher">
            <option value="">请选择教师</option>
            ${teachers.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
        </select></div>
    `);
    modalOnOk = async () => {
        const teacher_id = document.getElementById('a_teacher').value;
        if (!teacher_id) { alert('请选择教师'); return; }
        await api(`/students/assign-teacher/${id}`, 'PUT', { teacher_id: Number(teacher_id) });
        closeModal();
        loadStudents();
    };
}

/** 删除学生：确认后调用删除接口并刷新 */
async function delStudent(id) {
    if (!confirm('确定删除该学生？')) return;
    await api(`/students/del/${id}`, 'DELETE');
    loadStudents();
}

// ===== 教师管理 =====
/**
 * 格式化金额显示：空值显示「—」，非空保留两位小数
 * @param {*} v 金额（number 或 null）
 */
function fmtMoney(v) {
    return (v === null || v === undefined || v === '') ? '—' : Number(v).toFixed(2);
}

/**
 * 加载教师列表（支持关键字查询）
 * @param {string} keyword 姓名关键字（默认 ''）
 */
async function loadTeachers(keyword='') {
    const list = await api('/teachers/all?keyword=' + encodeURIComponent(keyword));
    document.getElementById('teacherBody').innerHTML = list.map(t => `
        <tr><td>${t.id}</td><td>${esc(t.name)}</td><td>${esc(t.gender)}</td>
        <td>${t.age}</td><td>${esc(t.subject)}</td><td>${esc(t.phone)}</td>
        <td>${esc(t.zhicheng_name) || '未评定'}</td>
        <td>${fmtMoney(t.base_salary)}</td><td>${fmtMoney(t.class_fee)}</td><td>${fmtMoney(t.bonus)}</td>
        <td>${t.course_count || 0}</td><td>${t.class_count || 0}</td><td>${t.student_count || 0}</td>
        <td>
            <button class="btn btn-blue" onclick="openTeacherModal('edit', ${t.id})">编辑</button>
            <button class="btn btn-red" onclick="delTeacher(${t.id})">删除</button>
        </td></tr>`).join('');
}
function searchTeachers() { loadTeachers(document.getElementById('teaKeyword').value.trim()); }
function resetTeachers() { document.getElementById('teaKeyword').value = ''; loadTeachers(); }

/**
 * 打开新增/编辑教师弹框
 * @param {string} mode 'add' / 'edit'
 * @param {number} id    编辑时的教师 ID
 */
async function openTeacherModal(mode, id) {
    // 编辑模式拉取教师详情预填
    let prefill = {};
    if (mode === 'edit') prefill = await api(`/teachers/one/${id}`) || {};
    // 加载职称列表供职称下拉（新增/编辑均提供）
    const zhichengs = await api('/zhicheng/all');
    openModal(mode === 'add' ? '新增教师' : '编辑教师', `
        <div class="field"><input id="t_name" placeholder="姓名" value="${esc(prefill.name)}"></div>
        <div class="field"><select id="t_gender">
            <option value="男" ${prefill.gender === '男' ? 'selected' : ''}>男</option>
            <option value="女" ${prefill.gender === '女' ? 'selected' : ''}>女</option>
        </select></div>
        <div class="field"><input id="t_age" type="number" placeholder="年龄（20-70）" value="${prefill.age ?? 30}"></div>
        <div class="field"><input id="t_subject" placeholder="教授科目" value="${esc(prefill.subject)}"></div>
        <div class="field"><input id="t_phone" placeholder="联系电话" value="${esc(prefill.phone)}"></div>
        <div class="field"><select id="t_zhicheng">
            <option value="">未评定职称</option>
            ${zhichengs.map(z => `<option value="${z.id}" ${prefill.zhicheng_id === z.id ? 'selected' : ''}>${esc(z.name)}（${z.level}级）</option>`).join('')}
        </select></div>
        <div class="field"><input id="t_base_salary" type="number" min="0" step="0.01" placeholder="基本工资（月薪，可留空）" value="${prefill.base_salary ?? ''}"></div>
        <div class="field"><input id="t_class_fee" type="number" min="0" step="0.01" placeholder="课时费（每课时，可留空）" value="${prefill.class_fee ?? ''}"></div>
        <div class="field"><input id="t_bonus" type="number" min="0" step="0.01" placeholder="奖金/津贴（可留空）" value="${prefill.bonus ?? ''}"></div>
    `);
    modalOnOk = async () => {
        const name = document.getElementById('t_name').value.trim();
        const subject = document.getElementById('t_subject').value.trim();
        const ageInput = document.getElementById('t_age').value;
        if (!name) { alert('请填写教师姓名'); return; }
        if (!subject) { alert('请填写教授科目'); return; }
        const age = Number(ageInput);
        if (!ageInput || isNaN(age) || age < 20 || age > 70) { alert('年龄需为 20-70 之间的数字'); return; }
        // 薪资三个字段：留空存 null，非空须为 >=0 的数字
        const money = id => {
            const v = document.getElementById(id).value.trim();
            if (v === '') return null;
            const n = Number(v);
            if (isNaN(n) || n < 0) { alert('薪资金额需为大于等于 0 的数字'); throw new Error('invalid-salary'); }
            return n;
        };
        const base_salary = money('t_base_salary');
        const class_fee = money('t_class_fee');
        const bonus = money('t_bonus');
        const body = {
            name,
            gender: document.getElementById('t_gender').value,
            age,
            subject,
            phone: document.getElementById('t_phone').value.trim(),
            zhicheng_id: Number(document.getElementById('t_zhicheng').value) || null,
            base_salary, class_fee, bonus
        };
        if (mode === 'add') {
            await api('/teachers/add', 'POST', body);
        } else {
            await api(`/teachers/update/${id}`, 'PUT', body);
        }
        closeModal();
        loadTeachers();
    };
}

/** 删除教师：确认后调用删除接口并刷新（后端会清空其课程/班级/学生引用） */
async function delTeacher(id) {
    if (!confirm('确定删除该教师？其名下课程、班主任班级、学生归属将被清空。')) return;
    await api(`/teachers/del/${id}`, 'DELETE');
    loadTeachers();
    loadCourses();
    loadClasses();
    loadStudents();
}

// ===== 课程管理 =====
/**
 * 加载课程列表（支持关键字查询）
 * @param {string} keyword 课程名关键字（默认 ''）
 */
async function loadCourses(keyword='') {
    const list = await api('/courses/all?keyword=' + encodeURIComponent(keyword));
    document.getElementById('courseBody').innerHTML = list.map(c => `
        <tr><td>${c.id}</td><td>${esc(c.name)}</td><td>${c.credit}</td>
        <td>${esc(c.teacher_name) || '未分配'}</td>
        <td>
            <button class="btn btn-blue" onclick="openCourseModal('edit', ${c.id})">编辑</button>
            <button class="btn btn-green" onclick="openSelectCourseModal(${c.id})">选课</button>
            <button class="btn btn-orange" onclick="openScoreModal(${c.id})">成绩</button>
            <button class="btn btn-red" onclick="delCourse(${c.id})">删除</button>
        </td></tr>`).join('');
}
function searchCourses() { loadCourses(document.getElementById('couKeyword').value.trim()); }
function resetCourses() { document.getElementById('couKeyword').value = ''; loadCourses(); }

/**
 * 打开新增/编辑课程弹框
 * @param {string} mode 'add' / 'edit'
 * @param {number} id    编辑时的课程 ID
 */
async function openCourseModal(mode, id) {
    // 编辑模式拉取课程详情预填
    let prefill = {};
    if (mode === 'edit') prefill = await api(`/courses/one/${id}`) || {};
    // 加载教师列表供授课教师下拉
    const teachers = await api('/teachers/all');
    openModal(mode === 'add' ? '新增课程' : '编辑课程', `
        <div class="field"><input id="c_name" placeholder="课程名称" value="${esc(prefill.name)}"></div>
        <div class="field"><input id="c_credit" type="number" placeholder="学分（1-10）" value="${prefill.credit ?? 1}"></div>
        <div class="field"><select id="c_teacher">
            <option value="">未分配教师</option>
            ${teachers.map(t => `<option value="${t.id}" ${prefill.teacher_id === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
        </select></div>
    `);
    modalOnOk = async () => {
        const name = document.getElementById('c_name').value.trim();
        if (!name) { alert('请填写课程名称'); return; }
        const creditInput = document.getElementById('c_credit').value;
        const credit = Number(creditInput);
        if (!creditInput || isNaN(credit) || credit < 1 || credit > 10) { alert('学分需为 1-10 之间的数字'); return; }
        const body = { name, credit, teacher_id: Number(document.getElementById('c_teacher').value) || null };
        if (mode === 'add') {
            await api('/courses/add', 'POST', body);
        } else {
            await api(`/courses/update/${id}`, 'PUT', body);
        }
        closeModal();
        loadCourses();
    };
}

/**
 * 打开选课弹框：下拉选择学生 → 为指定课程绑定该学生
 * @param {number} courseId 课程 ID
 */
async function openSelectCourseModal(courseId) {
    const students = await api('/students/all');
    openModal('选课（选择学生）', `
        <div class="field"><select id="c_student">
            <option value="">请选择学生</option>
            ${students.map(s => `<option value="${s.id}">${esc(s.name)}（学号${s.id}）</option>`).join('')}
        </select></div>
    `);
    modalOnOk = async () => {
        const sid = document.getElementById('c_student').value;
        if (!sid) { alert('请选择学生'); return; }
        await api(`/courses/select/${sid}`, 'POST', { course_id: courseId });
        closeModal();
        loadCourses();
    };
}

/**
 * 打开成绩登记弹框：列出该课程已选学生，逐个填写成绩
 * @param {number} courseId 课程 ID
 */
async function openScoreModal(courseId) {
    const [course, students] = await Promise.all([
        api(`/courses/one/${courseId}`),
        api(`/courses/students/${courseId}`)
    ]);
    if (!students.length) { alert('该课程暂无学生选课，无法登记成绩'); return; }
    openModal(`登记成绩 - ${esc(course.name)}`, `
        ${students.map(s => `
        <div class="field score-row">
            <span class="score-stu">${esc(s.student_name)}（${esc(s.grade) || '无年级'}，学号${s.student_id}）</span>
            <input id="score_${s.student_id}" type="number" min="0" max="100" step="0.5"
                   placeholder="成绩 0-100" value="${s.score ?? ''}">
        </div>`).join('')}
    `);
    modalOnOk = async () => {
        // 逐名学生提交；成绩留空则跳过（不覆盖已有成绩）
        for (const s of students) {
            const val = document.getElementById(`score_${s.student_id}`).value.trim();
            if (val === '') continue;
            const score = Number(val);
            if (isNaN(score) || score < 0 || score > 100) {
                alert(`学号 ${s.student_id}（${s.student_name}）成绩需为 0-100`);
                return;
            }
            await api(`/courses/score/${s.student_id}`, 'PUT', { course_id: courseId, score });
        }
        closeModal();
        loadCourses();
    };
}

/** 查看学生选课弹框中当前选中的学生 ID（退课刷新用） */
let viewStudentId = null;
/**
 * 渲染"查看学生选课"弹框的结果区（含退课按钮）
 * @param {number} sid 学生 ID
 */
async function renderViewResult(sid) {
    viewStudentId = sid;
    const list = await api(`/courses/student/${sid}`);
    const stuName = document.getElementById('v_student').selectedOptions[0].textContent;
    document.getElementById('v_result').innerHTML = list.length
        ? `<b>${esc(stuName)} 已选课程：</b><br>` +
          list.map(c => `· ${esc(c.course_name)}（${esc(c.teacher_name) || '未分配'}，${c.credit}学分` +
                         (c.score != null ? `，成绩${c.score}` : '') + `）
             <button class="btn btn-red btn-sm" onclick="unselectCourse(${sid}, ${c.course_id})">退课</button>`).join('<br>')
        : `${esc(stuName)} 未选任何课程`;
}
/** 退课：确认后调用退课接口并刷新结果区 */
async function unselectCourse(studentId, courseId) {
    if (!confirm('确定退掉该课程？')) return;
    await api(`/courses/unselect/${studentId}?course_id=${courseId}`, 'DELETE');
    renderViewResult(studentId);
}

/** 打开"查看学生选课"弹框：下拉选学生 → 展示其已选课程（可退课） */
async function openViewStudentCourses() {
    const students = await api('/students/all');
    openModal('查看学生选课', `
        <div class="field"><select id="v_student">
            <option value="">请选择学生</option>
            ${students.map(s => `<option value="${s.id}">${esc(s.name)}（学号${s.id}）</option>`).join('')}
        </select></div>
        <div id="v_result" class="modal-result"></div>
    `);
    // 确定：拉取该学生已选课程并渲染到弹框内
    modalOnOk = async () => {
        const sid = document.getElementById('v_student').value;
        if (!sid) { alert('请选择学生'); return; }
        renderViewResult(Number(sid));
    };
}

/** 删除课程：确认后调用删除接口并刷新 */
async function delCourse(id) {
    if (!confirm('确定删除该课程？')) return;
    await api(`/courses/del/${id}`, 'DELETE');
    loadCourses();
}

// ===== 班级管理 =====
/**
 * 加载班级列表（支持关键字查询）
 * @param {string} keyword 班级名关键字（默认 ''）
 */
async function loadClasses(keyword='') {
    const list = await api('/classes/all?keyword=' + encodeURIComponent(keyword));
    document.getElementById('classBody').innerHTML = list.map(c => `
        <tr><td>${c.id}</td><td>${esc(c.name)}</td><td>${esc(c.grade)}</td>
        <td>${esc(c.head_teacher_name) || '无'}</td>
        <td>
            <button class="btn btn-blue" onclick="openClassModal('edit', ${c.id})">编辑</button>
            <button class="btn btn-red" onclick="delClass(${c.id})">删除</button>
        </td></tr>`).join('');
}
function searchClasses() { loadClasses(document.getElementById('clsKeyword').value.trim()); }
function resetClasses() { document.getElementById('clsKeyword').value = ''; loadClasses(); }

/**
 * 打开新增/编辑班级弹框
 * @param {string} mode 'add' / 'edit'
 * @param {number} id    编辑时的班级 ID
 */
async function openClassModal(mode, id) {
    // 编辑模式拉取班级详情预填
    let prefill = {};
    if (mode === 'edit') prefill = await api(`/classes/one/${id}`) || {};
    // 加载教师列表供班主任下拉
    const teachers = await api('/teachers/all');
    openModal(mode === 'add' ? '新增班级' : '编辑班级', `
        <div class="field"><input id="cl_name" placeholder="班级名称" value="${esc(prefill.name)}"></div>
        <div class="field"><input id="cl_grade" placeholder="年级" value="${esc(prefill.grade)}"></div>
        <div class="field"><select id="cl_head">
            <option value="">无班主任</option>
            ${teachers.map(t => `<option value="${t.id}" ${prefill.head_teacher_id === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
        </select></div>
    `);
    modalOnOk = async () => {
        const name = document.getElementById('cl_name').value.trim();
        if (!name) { alert('请填写班级名称'); return; }
        const body = { name, grade: document.getElementById('cl_grade').value.trim() || '高一', head_teacher_id: Number(document.getElementById('cl_head').value) || null };
        if (mode === 'add') {
            await api('/classes/add', 'POST', body);
        } else {
            await api(`/classes/update/${id}`, 'PUT', body);
        }
        closeModal();
        loadClasses();
    };
}

/** 删除班级：确认后调用删除接口并刷新（后端会清空所属学生班级引用） */
async function delClass(id) {
    if (!confirm('确定删除该班级？所属学生将被设为未分班。')) return;
    await api(`/classes/del/${id}`, 'DELETE');
    loadClasses();
    loadStudents();
}

// ===== 职称管理 =====
/**
 * 加载职称列表（支持关键字查询）
 * @param {string} keyword 职称名关键字（默认 ''）
 */
async function loadZhicheng(keyword='') {
    const list = await api('/zhicheng/all?keyword=' + encodeURIComponent(keyword));
    document.getElementById('zhichengBody').innerHTML = list.map(z => `
        <tr><td>${z.id}</td><td>${esc(z.name)}</td><td>${z.level}</td>
        <td>${esc(z.description)}</td>
        <td>${z.teacher_names ? esc(z.teacher_names) : '<span class="muted">无教师</span>'}</td>
        <td>
            <button class="btn btn-blue" onclick="openZhichengModal('edit', ${z.id})">编辑</button>
            <button class="btn btn-red" onclick="delZhicheng(${z.id})">删除</button>
        </td></tr>`).join('');
}
function searchZhicheng() { loadZhicheng(document.getElementById('zcKeyword').value.trim()); }
function resetZhicheng() { document.getElementById('zcKeyword').value = ''; loadZhicheng(); }

/**
 * 打开新增/编辑职称弹框
 * @param {string} mode 'add' / 'edit'
 * @param {number} id    编辑时的职称 ID
 */
async function openZhichengModal(mode, id) {
    // 编辑模式拉取职称详情预填
    let prefill = {};
    if (mode === 'edit') prefill = await api(`/zhicheng/one/${id}`) || {};
    openModal(mode === 'add' ? '新增职称' : '编辑职称', `
        <div class="field"><input id="zc_name" placeholder="职称名称（如：教授）" value="${esc(prefill.name)}"></div>
        <div class="field"><input id="zc_level" type="number" placeholder="级别（1-10，越大越高）" value="${prefill.level ?? 1}"></div>
        <div class="field"><input id="zc_desc" placeholder="职称说明" value="${esc(prefill.description)}"></div>
    `);
    modalOnOk = async () => {
        const name = document.getElementById('zc_name').value.trim();
        if (!name) { alert('请填写职称名称'); return; }
        const lvlInput = document.getElementById('zc_level').value;
        const level = Number(lvlInput);
        if (!lvlInput || isNaN(level) || level < 1 || level > 10) { alert('级别需为 1-10 之间的数字'); return; }
        const body = { name, level, description: document.getElementById('zc_desc').value.trim() };
        if (mode === 'add') {
            await api('/zhicheng/add', 'POST', body);
        } else {
            await api(`/zhicheng/update/${id}`, 'PUT', body);
        }
        closeModal();
        loadZhicheng();
    };
}

/** 删除职称：确认后调用删除接口并刷新（后端会清空持有该职称教师的职称引用） */
async function delZhicheng(id) {
    if (!confirm('确定删除该职称？持有该职称的教师将被设为未评定。')) return;
    await api(`/zhicheng/del/${id}`, 'DELETE');
    loadZhicheng();
    loadTeachers();
}

// ===== 首页统计（学生用后端 total，其余取列表长度） =====
/** 加载首页统计卡片：学生总数取后端分页 total，其余取列表长度 */
async function loadStats() {
    const [studentPage, teachers, courses, classes] = await Promise.all([
        api('/students/page?page=1&page_size=1'),
        api('/teachers/all'),
        api('/courses/all'),
        api('/classes/all')
    ]);
    document.getElementById('studentCount').textContent = (studentPage && studentPage.total) || 0;
    document.getElementById('teacherCount').textContent = teachers.length;
    document.getElementById('courseCount').textContent = courses.length;
    document.getElementById('classCount').textContent = classes.length;
}

// ===== 统计分析图表（ECharts） =====
/**
 * 加载首页图表：
 * - 柱状图：各班级人数统计（/stats/class-count）
 * - 饼状图：在校学生男女占比（/stats/gender-ratio）
 */
async function loadCharts() {
    if (typeof echarts === 'undefined') return;   // ECharts 未加载则不渲染
    const [classes, genders] = await Promise.all([
        api('/stats/class-count'),
        api('/stats/gender-ratio')
    ]);

    // 柱状图：各班级人数
    const classChart = echarts.init(document.getElementById('classChart'));
    classChart.setOption({
        title: { text: '各班级人数', left: 'center', textStyle: { fontSize: 14 } },
        tooltip: { trigger: 'axis' },
        grid: { left: '8%', right: '8%', bottom: '12%', containLabel: true },
        xAxis: {
            type: 'category',
            data: (classes || []).map(c => c.class_name),
            axisLabel: { rotate: 30 }
        },
        yAxis: { type: 'value', minInterval: 1 },
        series: [{
            name: '人数',
            type: 'bar',
            data: (classes || []).map(c => c.cnt),
            itemStyle: { color: '#1890ff' },
            label: { show: true, position: 'top' }
        }]
    });

    // 饼状图：男女占比
    const genderChart = echarts.init(document.getElementById('genderChart'));
    genderChart.setOption({
        title: { text: '男女占比', left: 'center', textStyle: { fontSize: 14 } },
        tooltip: { trigger: 'item', formatter: '{b}: {c} 人 ({d}%)' },
        legend: { bottom: 0 },
        series: [{
            name: '性别占比',
            type: 'pie',
            radius: '55%',
            center: ['50%', '45%'],
            data: (genders || []).map(g => ({ name: g.gender, value: g.cnt })),
            label: { formatter: '{b}: {c} 人 ({d}%)' }
        }]
    });
}

// ===== 初始化加载 =====
// 页面加载即并行加载首页统计、图表与所有管理列表
loadStats(); loadCharts(); loadStudents(); loadTeachers(); loadCourses(); loadClasses(); loadZhicheng();
