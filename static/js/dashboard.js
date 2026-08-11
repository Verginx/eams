// EAMS 管理后台逻辑
// 依赖：common.js（api / logout / esc / currentUser / currentRole），请在 dashboard.js 之前引入
// 注意：所有插入 innerHTML 的用户数据必须经过 esc() 转义，防止 XSS

// ===== 登录信息 =====
// 填充欢迎语与当前用户（无鉴权，直接显示；未登录也可访问）
const username = localStorage.getItem('username') || '';
const role = localStorage.getItem('role') || 'student';
const isAdmin = role === 'admin';
document.getElementById('userInfo').textContent = '当前用户：' + username;
document.getElementById('welcomeTitle').textContent = '欢迎回来，' + username;
document.getElementById('welcomeSub').textContent =
    (isAdmin ? '管理员' : '同学') + ' · 这里是 EAMS 学校教务管理系统';
// 回收站仅管理员可见可操作
if (!isAdmin) {
    const recycleBtn = document.getElementById('recycleBtn');
    if (recycleBtn) recycleBtn.style.display = 'none';
}

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
let modalBusy = false;   // 提交锁：防止确定按钮双击/连点触发重复提交

/**
 * 打开通用弹框：设置标题与内容并显示
 * @param {string} title    弹框标题
 * @param {string} bodyHtml 弹框内容 HTML（表单/下拉等）
 */
function openModal(title, bodyHtml) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    // 撤销按钮默认隐藏，仅详情类弹框按需显示
    const undoBtn = document.getElementById('modalUndo');
    if (undoBtn) undoBtn.style.display = 'none';
    // 新弹框复位确定按钮（上一次提交可能禁用过它）
    document.getElementById('modalOk').disabled = false;
    modalBusy = false;
    document.getElementById('modal').style.display = 'flex';
}
/** 关闭弹框并清空确定回调 */
function closeModal() {
    document.getElementById('modal').style.display = 'none';
    modalOnOk = null;
    modalBusy = false;
    document.getElementById('modalOk').disabled = false;
}
// 弹框确定按钮：带提交锁执行当前 modalOnOk，异步期间禁用按钮防止重复提交
document.getElementById('modalOk').onclick = async () => {
    if (!modalOnOk || modalBusy) return;
    modalBusy = true;
    const btn = document.getElementById('modalOk');
    btn.disabled = true;
    try {
        await modalOnOk();
    } catch (e) {
        // 校验类异常已在 handler 内提示，此处静默兜底，保证按钮能复位
    } finally {
        modalBusy = false;
        btn.disabled = false;
    }
};

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

// ===== 业务域值常量（集中管理，避免散落硬编码） =====
const GRADES = ['高一', '高二', '高三'];                 // 年级固定集合（班级与学生共用）
const EDUCATIONS = ['本科', '硕士', '博士'];             // 教师学历
const COURSE_STATUSES = ['开课', '未开课'];              // 课程开课状态
const COURSE_MODES = ['线下', '线上'];                   // 课程授课方式

// ===== 学生管理（分页） =====
let stuPage = 1;             // 学生列表当前页码
const STU_PAGE_SIZE = 10;    // 每页条数（与后端 /students/page 默认一致）
let stuClassList = [];       // 新增学生弹框的班级列表（含班主任信息）
let stuTeacherList = [];     // 新增/编辑学生弹框的教师列表

/** 渲染空列表兜底行（colspan 占满整行居中显示提示） */
function emptyRow(colspan, msg='暂无数据') {
    return `<tr><td colspan="${colspan}" class="muted" style="text-align:center;padding:20px;">${msg}</td></tr>`;
}

/**
 * 新增学生弹框：年级变更 → 班级下拉仅显示同年级班级
 */
function filterStudentClasses() {
    const gradeSel = document.getElementById('s_grade');
    const clsSel = document.getElementById('s_classId');
    if (!gradeSel || !clsSel) return;
    const grade = gradeSel.value;
    clsSel.innerHTML = '<option value="">暂不分班</option>' +
        stuClassList.filter(c => c.grade === grade)
            .map(c => `<option value="${c.id}">${esc(c.name)}（${esc(c.grade)}）</option>`).join('');
}

/**
 * 加载学生列表（分页 + 关键字查询）
 * @param {string} keyword 姓名关键字（省略时读输入框 stuKeyword）
 */
async function loadStudents(keyword) {
    // 未显式传 keyword 时读查询输入框
    if (keyword === undefined) keyword = document.getElementById('stuKeyword').value.trim();
    // 调用分页接口（page/page_size/关键字），返回 {total, items}
    const data = await api(`/students/page?keyword=${encodeURIComponent(keyword)}&page=${stuPage}&page_size=${STU_PAGE_SIZE}`);
    const list = (data && data.items) || [];
    // 删除后当前页可能为空：回退一页重载
    if (stuPage > 1 && list.length === 0) { stuPage--; loadStudents(keyword); return; }
    const tbody = document.getElementById('studentBody');
    // 渲染学生行（含编辑/分班/选老师/选课/删除操作）；空列表展示兜底提示
    tbody.innerHTML = list.length ? list.map(s => `
        <tr>
            <td>${s.id}</td><td>${esc(s.name)}</td><td>${esc(s.gender)}</td>
            <td>${s.age}</td><td>${esc(s.grade)}</td><td>${esc(s.class_name) || '未分班'}</td>
            <td>${esc(s.teacher_name) || '未选老师'}</td><td>${s.course_count || 0}</td>
            <td>
                <button class="btn btn-blue" onclick="openStudentModal('edit', ${s.id})">编辑</button>
                <button class="btn btn-orange" onclick="openAssignClassModal(${s.id})">分班</button>
                <button class="btn btn-purple" onclick="openAssignTeacherModal(${s.id})">选老师</button>
                <button class="btn btn-green" onclick="openSelectStudentCourseModal(${s.id})">选课</button>
                <button class="btn btn-red" onclick="delStudent(${s.id})">删除</button>
            </td>
        </tr>`).join('') : emptyRow(9, keyword ? '未找到匹配的学生' : '暂无学生');
    renderStuPager((data && data.total) || 0);
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
    // 并行加载班级与教师列表，供新增/编辑时下拉
    [stuClassList, stuTeacherList] = await Promise.all([
        api('/classes/all') || [],
        api('/teachers/all') || []
    ]);
    const extraFields = `
        <div class="field"><select id="s_classId" onchange="">
            <option value="">暂不分班</option>
            ${(stuClassList || []).filter(c => c.grade === (prefill.grade || '高一')).map(c => `<option value="${c.id}" ${prefill.class_id === c.id ? 'selected' : ''}>${esc(c.name)}（${esc(c.grade)}）</option>`).join('')}
        </select></div>
        <div class="field"><select id="s_teacherId">
            <option value="">暂不选老师</option>
            ${(stuTeacherList || []).map(t => `<option value="${t.id}" ${prefill.teacher_id === t.id ? 'selected' : ''}>${esc(t.name)}（${esc(t.subject)}）</option>`).join('')}
        </select></div>`;
    openModal(mode === 'add' ? '新增学生' : '编辑学生', `
        <div class="field"><input id="s_name" placeholder="姓名" value="${esc(prefill.name)}"></div>
        <div class="field"><select id="s_gender">
            <option value="男" ${prefill.gender === '男' ? 'selected' : ''}>男</option>
            <option value="女" ${prefill.gender === '女' ? 'selected' : ''}>女</option>
        </select></div>
        <div class="field"><input id="s_age" type="number" placeholder="年龄（10-100）" value="${prefill.age ?? ''}"></div>
        <div class="field"><select id="s_grade" onchange="filterStudentClasses()">
            ${GRADES.map(g => `<option value="${g}" ${(prefill.grade || '高一') === g ? 'selected' : ''}>${g}</option>`).join('')}
        </select></div>
        ${extraFields}
    `);
    // 确定回调：前端校验 → 新增(POST)或编辑(PUT) → 关闭并刷新
    modalOnOk = async () => {
        const name = document.getElementById('s_name').value.trim();
        const ageInput = document.getElementById('s_age').value;
        if (!name) { showToast('请填写学生姓名', 'error'); return; }
        const age = Number(ageInput);
        if (!ageInput || isNaN(age) || age < 10 || age > 100) { showToast('年龄需为 10-100 之间的数字', 'error'); return; }
        const body = { name, gender: document.getElementById('s_gender').value, age, grade: document.getElementById('s_grade').value };
        if (mode === 'add') {
            // 新增：附带班级与老师（可空，后端校验存在性）
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
    // 分班：仅可选择与学生年级一致的班级（学生年级与班级年级固定对应）
    const stu = await api(`/students/one/${id}`);
    if (!stu) { showToast('学生不存在', 'error'); return; }
    const classes = await api('/classes/all') || [];
    const matched = classes.filter(c => c.grade === stu.grade);
    if (matched.length === 0) {
        showToast(`无符合该生年级（${stu.grade}）的班级`, 'error');
        return;
    }
    openModal('学生分班', `
        <div class="field">学生年级：${esc(stu.grade)}</div>
        <div class="field"><select id="a_class">
            <option value="">请选择班级</option>
            ${matched.map(c => `<option value="${c.id}">${esc(c.name)}（班主任：${esc(c.head_teacher_name) || '暂无'}）</option>`).join('')}
        </select></div>
        <div class="field hint">仅可选择与学生年级一致的班级</div>
    `);
    modalOnOk = async () => {
        const class_id = document.getElementById('a_class').value;
        if (!class_id) { showToast('请选择班级', 'error'); return; }
        await api(`/students/assign-class/${id}`, 'PUT', { class_id: Number(class_id) });
        closeModal();
        loadStudents();
    };
}

/**
 * 打开选老师弹框：下拉选择教师 → 绑定给学生
 * @param {number} id 学生 ID
 */
async function openAssignTeacherModal(id) {
    const stu = await api(`/students/one/${id}`);
    if (!stu) { showToast('学生不存在', 'error'); return; }
    const teachers = await api('/teachers/all') || [];
    if (!teachers.length) { showToast('暂无教师可选，请先新增教师', 'error'); return; }
    openModal('学生选老师', `
        <div class="field">学生：${esc(stu.name)}（学号 ${stu.id}）</div>
        <div class="field"><select id="a_teacher">
            <option value="">不指定老师</option>
            ${teachers.map(t => `<option value="${t.id}" ${stu.teacher_id === t.id ? 'selected' : ''}>${esc(t.name)}（${esc(t.subject)}）</option>`).join('')}
        </select></div>
        <div class="field hint">可留空以清空所选老师</div>
    `);
    modalOnOk = async () => {
        const teacher_id = document.getElementById('a_teacher').value;
        // 选中「不指定老师」且学生原有老师 → 传 null 清空；否则原样提交
        await api(`/students/assign-teacher/${id}`, 'PUT', { teacher_id: teacher_id ? Number(teacher_id) : null });
        closeModal();
        loadStudents();
    };
}

/**
 * 打开学生选课弹框：勾选课程 → 为指定学生选课/退课
 * 每个学生至少选 1 门课程；老师 = 学生所选老师（students.teacher_id）
 * @param {number} studentId 学生 ID
 */
async function openSelectStudentCourseModal(studentId) {
    const [courses, selected] = await Promise.all([
        api('/courses/all'),
        api(`/courses/student/${studentId}`)
    ]);
    const selectedIds = (selected || []).map(c => c.course_id);
    // 已满课程（enrolled>=max 且 max 非空）不可再勾选；已选中的除外（保留可退）
    const fullCourse = c => c.max_students != null && c.enrolled_count >= c.max_students;
    openModal('学生选课', `
        <div class="field"><b>请勾选课程</b>（学生至少需选 1 门；退课不可退掉最后一门；已满课程不可再选）</div>
        <div class="field course-check-list">
            ${(courses || []).map(c => {
                const isFull = fullCourse(c) && !selectedIds.includes(c.id);
                return `<label class="${isFull ? 'course-full' : ''}"><input type="checkbox" class="course-check" value="${c.id}"
                    ${selectedIds.includes(c.id) ? 'checked' : ''} ${isFull ? 'disabled' : ''}> ${esc(c.name)}
                    （${esc(c.teacher_name) || '未分配'}，${c.credit}学分${c.status === '未开课' ? '，未开课' : ''}${fullCourse(c) ? '，已满' : ''}）</label>`;
            }).join('') || '暂无课程'}
        </div>
    `);
    modalOnOk = async () => {
        const checked = [...document.querySelectorAll('.course-check:checked')].map(i => Number(i.value));
        // 求差：新增选课 + 退课
        const toAdd = checked.filter(id => !selectedIds.includes(id));
        const toRemove = selectedIds.filter(id => !checked.includes(id));
        if (toAdd.length === 0 && toRemove.length === 0) { closeModal(); return; }
        for (const cid of toAdd) await api(`/courses/select/${studentId}`, 'POST', { course_id: cid });
        for (const cid of toRemove) await api(`/courses/unselect/${studentId}?course_id=${cid}`, 'DELETE');
        closeModal();
        loadStudents();
    };
}

/** 删除学生：逻辑删除（移入回收站），操作人由请求头自动携带 */
async function delStudent(id) {
    if (!confirm('确定删除该学生？将移入回收站，可从回收站恢复。')) return;
    await api(`/students/del/${id}`, 'DELETE');
    loadStudents();
}

// ===== 学生回收站（管理员专属） =====
/** 打开回收站弹框：分页列出已删除学生，支持恢复 / 真实删除 */
async function openRecycleModal(page = 1) {
    const data = await api(`/students/recycle/list?keyword=&page=${page}&page_size=${STU_PAGE_SIZE}`, 'GET', null, { 'X-Current-Role': 'admin' });
    const list = (data && data.items) || [];
    const total = (data && data.total) || 0;
    const totalPages = Math.max(1, Math.ceil(total / STU_PAGE_SIZE));
    openModal('回收站（已删除学生）', `
        ${list.length ? list.map(s => `
            <div class="recycle-row">
                <span><b>${esc(s.name)}</b>（学号 ${s.id} · ${esc(s.grade)} · 删除于 ${esc(s.delete_time)}）</span>
                <button class="btn btn-green btn-sm" onclick="recoverStudent(${s.id})">恢复</button>
                <button class="btn btn-red btn-sm" onclick="realDeleteStudent(${s.id})">永久删除</button>
            </div>`).join('') : '<div class="muted">回收站为空</div>'}
        ${totalPages > 1 ? `<div class="pagination">
            <button class="btn" ${page <= 1 ? 'disabled' : ''} onclick="openRecycleModal(${page - 1})">上一页</button>
            <span class="page-info">第 ${page} / ${totalPages} 页（共 ${total} 条）</span>
            <button class="btn" ${page >= totalPages ? 'disabled' : ''} onclick="openRecycleModal(${page + 1})">下一页</button>
        </div>` : ''}
    `);
    modalOnOk = () => { closeModal(); loadStudents(); loadStats(); };
}

/** 恢复学生：从回收站还原 */
async function recoverStudent(id) {
    if (!confirm('确定恢复该学生？')) return;
    await api(`/students/recycle/recover/${id}`, 'PUT', null, { 'X-Current-Role': 'admin' });
    openRecycleModal();
    loadStats();
}

/** 真实删除：物理删除学生（含选课记录与账号），不可恢复 */
async function realDeleteStudent(id) {
    if (!confirm('确定永久删除该学生？将同时删除其选课记录和账号，不可恢复！')) return;
    await api(`/students/recycle/real-del/${id}`, 'DELETE', null, { 'X-Current-Role': 'admin' });
    openRecycleModal();
    loadStats();
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
    const list = await api('/teachers/all?keyword=' + encodeURIComponent(keyword)) || [];
    document.getElementById('teacherBody').innerHTML = list.length ? list.map(t => `
        <tr><td>${t.id}</td><td>${esc(t.name)}</td><td>${esc(t.gender)}</td>
        <td>${t.age}</td><td>${esc(t.subject)}</td>
        <td>${esc(t.education) || '—'}</td><td>${esc(t.hire_date) || '—'}</td>
        <td>${esc(t.phone)}</td>
        <td>${esc(t.zhicheng_name) || '未评定'}</td>
        <td>${fmtMoney(t.base_salary)}</td><td>${fmtMoney(t.class_fee_total)}</td><td>${fmtMoney(t.bonus)}</td>
        <td>${t.student_count || 0}</td>
        <td>
            <button class="btn btn-blue" onclick="openTeacherModal('edit', ${t.id})">编辑</button>
            <button class="btn btn-green" onclick="viewTeacherDetail(${t.id})">详情</button>
            <button class="btn btn-red" onclick="delTeacher(${t.id})">删除</button>
        </td></tr>`).join('') : emptyRow(14, keyword ? '未找到匹配的教师' : '暂无教师');
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
    const zhichengs = await api('/zhicheng/all') || [];
    openModal(mode === 'add' ? '新增教师' : '编辑教师', `
        <div class="field"><input id="t_name" placeholder="姓名" value="${esc(prefill.name)}"></div>
        <div class="field"><select id="t_gender">
            <option value="男" ${prefill.gender === '男' ? 'selected' : ''}>男</option>
            <option value="女" ${prefill.gender === '女' ? 'selected' : ''}>女</option>
        </select></div>
        <div class="field"><input id="t_age" type="number" placeholder="年龄（20-70）" value="${prefill.age ?? 30}"></div>
        <div class="field"><input id="t_subject" placeholder="教授科目" value="${esc(prefill.subject)}"></div>
        <div class="field"><input id="t_phone" placeholder="联系电话" value="${esc(prefill.phone)}"></div>
        <div class="field"><select id="t_education">
            <option value="">学历（可选）</option>
            ${EDUCATIONS.map(e => `<option value="${e}" ${prefill.education === e ? 'selected' : ''}>${e}</option>`).join('')}
        </select></div>
        <div class="field"><input id="t_hire_date" type="date" value="${prefill.hire_date || ''}"></div>
        <div class="field"><input id="t_remark" placeholder="备注（可选）" value="${esc(prefill.remark)}"></div>
        <div class="field"><select id="t_zhicheng">
            <option value="">未评定职称</option>
            ${zhichengs.map(z => `<option value="${z.id}" ${prefill.zhicheng_id === z.id ? 'selected' : ''}>${esc(z.name)}（${z.level}级）</option>`).join('')}
        </select></div>
        <div class="field"><input id="t_base_salary" type="number" min="0" step="0.01" placeholder="基本工资（月薪，可留空）" value="${prefill.base_salary ?? ''}"></div>
        <div class="field"><input id="t_class_fee" type="number" min="0" step="0.01" placeholder="课时费单价（每学生，可留空；总额=单价×所带学生数）" value="${prefill.class_fee ?? ''}"></div>
        <div class="field"><input id="t_bonus" type="number" min="0" step="0.01" placeholder="奖金/津贴（可留空）" value="${prefill.bonus ?? ''}"></div>
    `);
    // 编辑弹框显示「撤销」按钮（点击关闭弹框，不保存修改）
    if (mode === 'edit') document.getElementById('modalUndo').style.display = 'inline-block';
    modalOnOk = async () => {
        const name = document.getElementById('t_name').value.trim();
        const subject = document.getElementById('t_subject').value.trim();
        const ageInput = document.getElementById('t_age').value;
        if (!name) { showToast('请填写教师姓名', 'error'); return; }
        if (!subject) { showToast('请填写教授科目', 'error'); return; }
        const age = Number(ageInput);
        if (!ageInput || isNaN(age) || age < 20 || age > 70) { showToast('年龄需为 20-70 之间的数字', 'error'); return; }
        // 薪资三个字段：留空存 null，非空须为 >=0 的数字
        const money = id => {
            const v = document.getElementById(id).value.trim();
            if (v === '') return null;
            const n = Number(v);
            if (isNaN(n) || n < 0) { showToast('薪资金额需为大于等于 0 的数字', 'error'); throw new Error('invalid-salary'); }
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
            education: document.getElementById('t_education').value || null,
            hire_date: document.getElementById('t_hire_date').value || null,
            remark: document.getElementById('t_remark').value.trim() || null,
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

/** 教师详情：展示基本信息 + 授课课程 + 班主任班级 + 选其课程的学生 */
async function viewTeacherDetail(id) {
    const d = await api(`/teachers/${id}/detail`);
    if (!d) { showToast('教师不存在', 'error'); return; }
    const coursesHtml = (d.courses && d.courses.length)
        ? d.courses.map(c => `<li>${esc(c.name)}（${c.credit} 学分）</li>`).join('')
        : '<li class="muted">无授课课程</li>';
    const classesHtml = (d.classes && d.classes.length)
        ? d.classes.map(c => `<li>${esc(c.name)}</li>`).join('')
        : '<li class="muted">无班主任班级</li>';
    const studentsHtml = (d.students && d.students.length)
        ? d.students.map(s => `<li>${esc(s.name)}（${esc(s.class_name) || '未分班'}）</li>`).join('')
        : '<li class="muted">无选课学生</li>';
    openModal(`教师详情 - ${esc(d.name)}`, `
        <table class="detail-table">
            <tr><th>姓名</th><td>${esc(d.name)}</td><th>性别</th><td>${esc(d.gender)}</td></tr>
            <tr><th>年龄</th><td>${d.age}</td><th>科目</th><td>${esc(d.subject)}</td></tr>
            <tr><th>学历</th><td>${esc(d.education) || '—'}</td><th>入职日期</th><td>${esc(d.hire_date) || '—'}</td></tr>
            <tr><th>电话</th><td>${esc(d.phone)}</td><th>职称</th><td>${esc(d.zhicheng_name) || '未评定'}</td></tr>
            <tr><th>基本工资</th><td>${fmtMoney(d.base_salary)}</td><th>课时费单价</th><td>${fmtMoney(d.class_fee)}</td></tr>
            <tr><th>课时费总额</th><td>${fmtMoney(d.class_fee_total)}</td><th>所带学生数</th><td>${d.student_count || 0}</td></tr>
            <tr><th>奖金</th><td>${fmtMoney(d.bonus)}</td><th></th><td></td></tr>
            <tr><th>备注</th><td colspan="3">${esc(d.remark) || '—'}</td></tr>
        </table>
        <div class="detail-block"><h4>授课课程</h4><ul>${coursesHtml}</ul></div>
        <div class="detail-block"><h4>班主任班级</h4><ul>${classesHtml}</ul></div>
        <div class="detail-block"><h4>选其课程的学生</h4><ul>${studentsHtml}</ul></div>
    `);
    modalOnOk = () => closeModal();
}

/** 删除教师：确认后调用删除接口并刷新（后端会清空其课程/班级引用） */
async function delTeacher(id) {
    if (!confirm('确定删除该教师？其授课课程、班主任班级将被清空，选其课程的学生将失去该课程。')) return;
    await api(`/teachers/del/${id}`, 'DELETE');
    loadTeachers();
    loadCourses();
    loadClasses();
    loadStudents();
}

// ===== 课程管理 =====
/** 生成课程选课进度单元格：最大/当前人数 + 块状进度条 + 百分比（max_students 为空时不限制） */
function courseProgressCell(c) {
    if (c.max_students == null) return '<td class="cp-cell">不限</td>';
    const enrolled = c.enrolled_count || 0;
    const max = c.max_students;
    const pct = Math.max(0, Math.min(100, Math.round(enrolled / max * 100)));
    const filled = Math.floor(pct / 10);
    const blocks = '█'.repeat(filled) + '░'.repeat(10 - filled);
    const level = pct >= 100 ? 'full' : (pct >= 80 ? 'high' : 'ok');
    return `<td class="cp-cell">
        <div class="cp-meta">最大人数：${max}，当前人数：${enrolled}</div>
        <div class="cp-bar ${level}">选课进度：<span class="cp-blocks">${blocks}</span> <b>${pct}%</b></div>
    </td>`;
}

/**
 * 加载课程列表（支持关键字查询）
 * @param {string} keyword 课程名关键字（默认 ''）
 */
async function loadCourses(keyword='') {
    const list = await api('/courses/all?keyword=' + encodeURIComponent(keyword)) || [];
    document.getElementById('courseBody').innerHTML = list.length ? list.map(c => `
        <tr><td>${c.id}</td><td>${esc(c.name)}</td><td>${c.credit}</td>
        <td>${esc(c.teacher_name) || '未分配'}</td>
        <td>${esc(c.status) || '开课'}</td><td>${esc(c.mode) || '线下'}</td>
        ${courseProgressCell(c)}
        <td>
            <button class="btn btn-blue" onclick="openCourseModal('edit', ${c.id})">编辑</button>
            <button class="btn btn-green" onclick="openSelectCourseModal(${c.id})">选课</button>
            <button class="btn btn-orange" onclick="openScoreModal(${c.id})">成绩</button>
            <button class="btn btn-red" onclick="delCourse(${c.id})">删除</button>
        </td></tr>`).join('') : emptyRow(8, keyword ? '未找到匹配的课程' : '暂无课程');
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
    const teachers = await api('/teachers/all') || [];
    openModal(mode === 'add' ? '新增课程' : '编辑课程', `
        <div class="field"><input id="c_name" placeholder="课程名称" value="${esc(prefill.name)}"></div>
        <div class="field"><input id="c_credit" type="number" placeholder="学分（1-10）" value="${prefill.credit ?? 1}"></div>
        <div class="field"><select id="c_teacher">
            <option value="">未分配教师</option>
            ${teachers.map(t => `<option value="${t.id}" ${prefill.teacher_id === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
        </select></div>
        <div class="field"><select id="c_status">
            ${COURSE_STATUSES.map(s => `<option value="${s}" ${(prefill.status || '开课') === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select></div>
        <div class="field"><select id="c_mode">
            ${COURSE_MODES.map(m => `<option value="${m}" ${(prefill.mode || '线下') === m ? 'selected' : ''}>${m}</option>`).join('')}
        </select></div>
        <div class="field"><input id="c_max" type="number" min="0" placeholder="人数上限（留空=不限制）" value="${prefill.max_students ?? ''}"></div>
    `);
    modalOnOk = async () => {
        const name = document.getElementById('c_name').value.trim();
        if (!name) { showToast('请填写课程名称', 'error'); return; }
        const creditInput = document.getElementById('c_credit').value;
        const credit = Number(creditInput);
        if (!creditInput || isNaN(credit) || credit < 1 || credit > 10) { showToast('学分需为 1-10 之间的数字', 'error'); return; }
        // 人数上限：留空存 null，非空须为 >=0 整数
        let max_students = null;
        const maxInput = document.getElementById('c_max').value.trim();
        if (maxInput !== '') {
            const m = Number(maxInput);
            if (isNaN(m) || m < 0 || !Number.isInteger(m)) { showToast('人数上限需为大于等于 0 的整数', 'error'); return; }
            max_students = m;
        }
        const body = {
            name, credit,
            teacher_id: Number(document.getElementById('c_teacher').value) || null,
            status: document.getElementById('c_status').value,
            mode: document.getElementById('c_mode').value,
            max_students
        };
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
    const [courses, students] = await Promise.all([
        api('/courses/all'),
        api('/students/all')
    ]);
    const course = (courses || []).find(c => c.id === courseId) || {};
    // 课程已满时提示，避免继续选人
    const full = course.max_students != null && course.enrolled_count >= course.max_students;
    openModal(`选课 - ${esc(course.name || '')}（授课：${esc(course.teacher_name) || '未分配'}）`, `
        <div class="field"><select id="c_student">
            <option value="">请选择学生</option>
            ${(students || []).map(s => `<option value="${s.id}">${esc(s.name)}（${esc(s.class_name) || '未分班'} · 已选${s.course_count || 0}门，学号${s.id}）</option>`).join('')}
        </select></div>
        ${full ? '<div class="field hint">该课程已满（' + course.enrolled_count + '/' + course.max_students + '），不建议继续选人</div>' : ''}
    `);
    modalOnOk = async () => {
        const sid = document.getElementById('c_student').value;
        if (!sid) { showToast('请选择学生', 'error'); return; }
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
    if (!students || !students.length) { showToast('该课程暂无学生选课，无法登记成绩', 'error'); return; }
    openModal(`登记成绩 - ${esc(course.name)}`, `
        ${students.map(s => `
        <div class="field score-row">
            <span class="score-stu">${esc(s.student_name)}（${esc(s.grade) || '无年级'}，学号${s.student_id}）</span>
            <input id="score_${s.student_id}" type="number" min="0" max="100" step="0.5"
                   placeholder="成绩 0-100" value="${s.score ?? ''}">
        </div>`).join('')}
    `);
    modalOnOk = async () => {
        // 先整体校验所有填写项，避免"提交一半后报错"的部分失败
        const updates = [];
        for (const s of students) {
            const val = document.getElementById(`score_${s.student_id}`).value.trim();
            if (val === '') continue;  // 留空则跳过（不覆盖已有成绩）
            const score = Number(val);
            if (isNaN(score) || score < 0 || score > 100) {
                showToast(`学号 ${s.student_id}（${s.student_name}）成绩需为 0-100`, 'error');
                return;
            }
            updates.push({ student_id: s.student_id, score });
        }
        if (updates.length === 0) { closeModal(); return; }
        // 校验通过后并行提交，避免逐条串行等待
        await Promise.all(updates.map(u => api(`/courses/score/${u.student_id}`, 'PUT', { course_id: courseId, score: u.score })));
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
    const list = await api(`/courses/student/${sid}`) || [];
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
    const students = await api('/students/all') || [];
    openModal('查看学生选课', `
        <div class="field"><select id="v_student">
            <option value="">请选择学生</option>
            ${students.map(s => `<option value="${s.id}">${esc(s.name)}（${esc(s.class_name) || '未分班'} · 已选${s.course_count || 0}门，学号${s.id}）</option>`).join('')}
        </select></div>
        <div id="v_result" class="modal-result"></div>
    `);
    // 确定：拉取该学生已选课程并渲染到弹框内
    modalOnOk = async () => {
        const sid = document.getElementById('v_student').value;
        if (!sid) { showToast('请选择学生', 'error'); return; }
        renderViewResult(Number(sid));
    };
}

/** 删除课程：确认后调用删除接口并刷新（若会使某学生降到 0 门课程则被后端拦截） */
async function delCourse(id) {
    if (!confirm('确定删除该课程？若它是某些学生的唯一课程，将被禁止删除。')) return;
    await api(`/courses/del/${id}`, 'DELETE');
    loadCourses();
}

// ===== 班级管理 =====
/**
 * 加载班级列表（支持关键字查询）
 * @param {string} keyword 班级名关键字（默认 ''）
 */
async function loadClasses(keyword='') {
    const list = await api('/classes/all?keyword=' + encodeURIComponent(keyword)) || [];
    document.getElementById('classBody').innerHTML = list.length ? list.map(c => `
        <tr><td>${c.id}</td><td>${esc(c.name)}</td><td>${esc(c.grade)}</td>
        <td>${esc(c.head_teacher_name) || '无'}</td>
        <td>${c.student_count || 0}</td>
        <td>
            <button class="btn btn-green" onclick="viewClassDetail(${c.id})">详情</button>
            <button class="btn btn-blue" onclick="openClassModal('edit', ${c.id})">编辑</button>
            <button class="btn btn-red" onclick="delClass(${c.id})">删除</button>
        </td></tr>`).join('') : emptyRow(6, keyword ? '未找到匹配的班级' : '暂无班级');
}
function searchClasses() { loadClasses(document.getElementById('clsKeyword').value.trim()); }
function resetClasses() { document.getElementById('clsKeyword').value = ''; loadClasses(); }

/** 班级详情：展示班主任、学生名单、男女统计 */
async function viewClassDetail(id) {
    const d = await api(`/classes/${id}/detail`);
    if (!d) { showToast('班级不存在', 'error'); return; }
    const cls = d.class || {};
    const ht = d.head_teacher || {};
    const studentsHtml = (d.students && d.students.length)
        ? d.students.map(s => `<li>${esc(s.name)}（${esc(s.gender)}，${s.age}岁）</li>`).join('')
        : '<li class="muted">暂无学生</li>';
    const genderHtml = Object.keys(d.gender_stats || {}).map(g => `${esc(g)} ${d.gender_stats[g]}人`).join(' / ') || '—';
    openModal(`班级详情 - ${esc(cls.name)}`, `
        <table class="detail-table">
            <tr><th>班级名</th><td>${esc(cls.name)}</td><th>年级</th><td>${esc(cls.grade)}</td></tr>
            <tr><th>班主任</th><td>${esc(ht.name) || '未设置'}</td><th>学生数</th><td>${d.student_count || 0}</td></tr>
            <tr><th>男女统计</th><td colspan="3">${genderHtml}</td></tr>
        </table>
        <div class="detail-block"><h4>学生名单</h4><ul>${studentsHtml}</ul></div>
    `);
    modalOnOk = () => closeModal();
}

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
    const teachers = await api('/teachers/all') || [];
    openModal(mode === 'add' ? '新增班级' : '编辑班级', `
        <div class="field"><input id="cl_name" placeholder="班级名称" value="${esc(prefill.name)}"></div>
        <div class="field"><select id="cl_grade">
            ${GRADES.map(g => `<option value="${g}" ${(prefill.grade || '高一') === g ? 'selected' : ''}>${g}</option>`).join('')}
        </select></div>
        <div class="field"><select id="cl_head">
            <option value="">无班主任</option>
            ${teachers.map(t => `<option value="${t.id}" ${prefill.head_teacher_id === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
        </select></div>
    `);
    modalOnOk = async () => {
        const name = document.getElementById('cl_name').value.trim();
        if (!name) { showToast('请填写班级名称', 'error'); return; }
        const body = { name, grade: document.getElementById('cl_grade').value, head_teacher_id: Number(document.getElementById('cl_head').value) || null };
        if (mode === 'add') {
            await api('/classes/add', 'POST', body);
        } else {
            await api(`/classes/update/${id}`, 'PUT', body);
        }
        closeModal();
        loadClasses();
    };
}

/** 删除班级：确认后调用删除接口并刷新（后端会阻止删除非空班级） */
async function delClass(id) {
    if (!confirm('确定删除该班级？班级下有学生将被禁止删除。')) return;
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
    const list = await api('/zhicheng/all?keyword=' + encodeURIComponent(keyword)) || [];
    document.getElementById('zhichengBody').innerHTML = list.length ? list.map(z => `
        <tr><td>${z.id}</td><td>${esc(z.name)}</td><td>${z.level}</td>
        <td>${esc(z.description)}</td>
        <td>${z.teacher_names ? esc(z.teacher_names) : '<span class="muted">无教师</span>'}</td>
        <td>
            <button class="btn btn-blue" onclick="openZhichengModal('edit', ${z.id})">编辑</button>
            <button class="btn btn-red" onclick="delZhicheng(${z.id})">删除</button>
        </td></tr>`).join('') : emptyRow(6, keyword ? '未找到匹配的职称' : '暂无职称');
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
        <div class="field"><input id="zc_name" placeholder="职称名称（如：中级）" value="${esc(prefill.name)}"></div>
        <div class="field"><input id="zc_level" type="number" placeholder="级别（1-10，越大越高）" value="${prefill.level ?? 1}"></div>
        <div class="field"><input id="zc_desc" placeholder="职称说明" value="${esc(prefill.description)}"></div>
    `);
    modalOnOk = async () => {
        const name = document.getElementById('zc_name').value.trim();
        if (!name) { showToast('请填写职称名称', 'error'); return; }
        const lvlInput = document.getElementById('zc_level').value;
        const level = Number(lvlInput);
        if (!lvlInput || isNaN(level) || level < 1 || level > 10) { showToast('级别需为 1-10 之间的数字', 'error'); return; }
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
    document.getElementById('teacherCount').textContent = (teachers || []).length;
    document.getElementById('courseCount').textContent = (courses || []).length;
    document.getElementById('classCount').textContent = (classes || []).length;
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
