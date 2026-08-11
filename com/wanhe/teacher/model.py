# 文件名：teacher/model.py
"""
教师模块 - 数据访问层

职责：封装 teachers 表 SQL 操作（增删改查 + 按姓名关键字查询），关联职称与统计
包含：职称名（LEFT JOIN zhicheng）、授课课程数、班主任班级数、所带学生数（子查询）、课时费总额
课时费总额 = 单价 × 所带学生数（student_count = 选择该教师所授课程的去重学生数）
依赖：common.db.Database
"""
from com.wanhe.common.db import Database


class TeacherModel:
    """教师表数据访问"""

    def _base_sql(self):
        """
        教师列表基础 SQL（含职称名与课程/班级/学生数/课时费总额子查询）
        :return: (sql, params)：sql 不含 WHERE/ORDER，params 为空列表供追加
        """
        sql = (
            "SELECT t.*, z.name AS zhicheng_name, "
            "       (SELECT COUNT(*) FROM courses c "
            "        WHERE c.teacher_id = t.id) AS course_count, "
            "       (SELECT COUNT(*) FROM classes cl "
            "        WHERE cl.head_teacher_id = t.id) AS class_count, "
            "       (SELECT COUNT(DISTINCT sc.student_id) FROM student_course sc "
            "        JOIN courses c ON sc.course_id = c.id "
            "        WHERE c.teacher_id = t.id) AS student_count, "
            "       t.class_fee * (SELECT COUNT(DISTINCT sc.student_id) FROM student_course sc "
            "        JOIN courses c ON sc.course_id = c.id "
            "        WHERE c.teacher_id = t.id) AS class_fee_total "
            "FROM teachers t "
            "LEFT JOIN zhicheng z ON t.zhicheng_id = z.id "
        )
        params = []
        return sql, params

    def get_all(self, keyword=''):
        """
        查询所有教师（含职称名、课程/班级/学生数、课时费总额），可按姓名模糊查询
        :param keyword: 姓名关键字（可选）
        :return: 教师行字典列表
        """
        sql, params = self._base_sql()
        if keyword:
            sql += "WHERE t.name LIKE %s "
            params.append(f"%{keyword}%")
        sql += "ORDER BY t.id"
        with Database() as db:
            return db.query_all(sql, tuple(params))

    def get_by_id(self, teacher_id):
        """
        按 ID 查询教师（含职称名、课程/班级/学生数、课时费总额）
        :param teacher_id: 教师 ID
        :return: 教师行 dict；不存在返回 None
        """
        with Database() as db:
            return db.query_one(self._base_sql()[0] + "WHERE t.id = %s", (teacher_id,))

    def create(self, name, gender, age, subject, phone, zhicheng_id, base_salary, class_fee, bonus,
               education, hire_date, remark):
        """
        新增教师
        :return: 新教师自增 ID
        """
        with Database() as db:
            return db.insert(
                "INSERT INTO teachers (name, gender, age, subject, phone, zhicheng_id, "
                "base_salary, class_fee, bonus, education, hire_date, remark) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (name, gender, age, subject, phone, zhicheng_id, base_salary, class_fee, bonus,
                 education, hire_date, remark)
            )

    def update(self, teacher_id, name, gender, age, subject, phone, zhicheng_id,
               base_salary, class_fee, bonus, education, hire_date, remark):
        """
        修改教师信息
        :return: 受影响行数
        """
        with Database() as db:
            return db.execute(
                "UPDATE teachers SET name=%s, gender=%s, age=%s, "
                "subject=%s, phone=%s, zhicheng_id=%s, "
                "base_salary=%s, class_fee=%s, bonus=%s, "
                "education=%s, hire_date=%s, remark=%s WHERE id=%s",
                (name, gender, age, subject, phone, zhicheng_id,
                 base_salary, class_fee, bonus, education, hire_date, remark, teacher_id)
            )

    def get_detail(self, teacher_id):
        """
        教师详情：基本信息 + 授课课程列表 + 班主任班级列表 + 选其课程的学生列表
        :return: dict {**教师基础行, courses, classes, students}；教师不存在返回 None
        """
        with Database() as db:
            base = db.query_one(self._base_sql()[0] + "WHERE t.id = %s", (teacher_id,))
            if base is None:
                return None
            base["courses"] = db.query_all(
                "SELECT id, name, credit FROM courses WHERE teacher_id = %s ORDER BY id", (teacher_id,)
            )
            base["classes"] = db.query_all(
                "SELECT id, name FROM classes WHERE head_teacher_id = %s ORDER BY id", (teacher_id,)
            )
            base["students"] = db.query_all(
                "SELECT DISTINCT s.id, s.name, c.name AS class_name "
                "FROM student_course sc "
                "JOIN courses co ON sc.course_id = co.id "
                "JOIN students s ON sc.student_id = s.id "
                "LEFT JOIN classes c ON s.class_id = c.id "
                "WHERE co.teacher_id = %s ORDER BY s.id", (teacher_id,)
            )
            return base

    def delete(self, teacher_id):
        """
        删除教师（同时清空其授课课程与班主任班级引用）
        :return: 受影响行数
        """
        with Database() as db:
            db.execute("UPDATE courses SET teacher_id = NULL WHERE teacher_id = %s", (teacher_id,))
            db.execute("UPDATE classes SET head_teacher_id = NULL WHERE head_teacher_id = %s", (teacher_id,))
            return db.execute("DELETE FROM teachers WHERE id = %s", (teacher_id,))