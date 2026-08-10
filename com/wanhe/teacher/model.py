# 文件名：teacher/model.py
"""
教师模块 - 数据访问层

职责：封装 teachers 表 SQL 操作（增删改查 + 按姓名关键字查询），关联职称与统计
包含：职称名（LEFT JOIN zhicheng）、授课课程数、班主任班级数、名下学生数（子查询）
依赖：common.db.Database
"""
from com.wanhe.common.db import Database


class TeacherModel:
    """教师表数据访问"""

    def _base_sql(self):
        """
        教师列表基础 SQL（含职称名与课程/班级/学生数子查询）
        :return: (sql, params)：sql 不含 WHERE/ORDER，params 为空列表供追加
        """
        sql = (
            "SELECT t.*, z.name AS zhicheng_name, "
            "       (SELECT COUNT(*) FROM courses c "
            "        WHERE c.teacher_id = t.id) AS course_count, "
            "       (SELECT COUNT(*) FROM classes cl "
            "        WHERE cl.head_teacher_id = t.id) AS class_count, "
            "       (SELECT COUNT(*) FROM students st "
            "        WHERE st.teacher_id = t.id) AS student_count "
            "FROM teachers t "
            "LEFT JOIN zhicheng z ON t.zhicheng_id = z.id "
        )
        params = []
        return sql, params

    def get_all(self, keyword=''):
        """
        查询所有教师（含职称名、课程/班级/学生数），可按姓名模糊查询
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
        按 ID 查询教师（含职称名、课程/班级/学生数）
        :param teacher_id: 教师 ID
        :return: 教师行 dict；不存在返回 None
        """
        with Database() as db:
            return db.query_one(self._base_sql()[0] + "WHERE t.id = %s", (teacher_id,))

    def create(self, name, gender, age, subject, phone, zhicheng_id, base_salary, class_fee, bonus):
        """
        新增教师
        :return: 新教师自增 ID
        """
        with Database() as db:
            return db.insert(
                "INSERT INTO teachers (name, gender, age, subject, phone, zhicheng_id, "
                "base_salary, class_fee, bonus) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (name, gender, age, subject, phone, zhicheng_id, base_salary, class_fee, bonus)
            )

    def update(self, teacher_id, name, gender, age, subject, phone, zhicheng_id,
               base_salary, class_fee, bonus):
        """
        修改教师信息
        :return: 受影响行数
        """
        with Database() as db:
            return db.execute(
                "UPDATE teachers SET name=%s, gender=%s, age=%s, "
                "subject=%s, phone=%s, zhicheng_id=%s, "
                "base_salary=%s, class_fee=%s, bonus=%s WHERE id=%s",
                (name, gender, age, subject, phone, zhicheng_id,
                 base_salary, class_fee, bonus, teacher_id)
            )

    def delete(self, teacher_id):
        """
        删除教师（同时清空其授课课程、班主任班级、名下学生的教师引用）
        :return: 受影响行数
        """
        with Database() as db:
            db.execute("UPDATE courses SET teacher_id = NULL WHERE teacher_id = %s", (teacher_id,))
            db.execute("UPDATE classes SET head_teacher_id = NULL WHERE head_teacher_id = %s", (teacher_id,))
            db.execute("UPDATE students SET teacher_id = NULL WHERE teacher_id = %s", (teacher_id,))
            return db.execute("DELETE FROM teachers WHERE id = %s", (teacher_id,))