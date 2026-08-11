# 文件名：student/model.py
"""
学生模块 - 数据访问层

职责：
- 封装 students 表及相关联表（classes/teachers/student_course）的 SQL 操作
- 包含：增删改查、分班、选老师、关键字查询、分页查询、逻辑删除、回收站管理、真实删除
- 所有正常查询均过滤 is_deleted=0，回收站数据不会出现在正常列表中
依赖：common.db.Database
"""
from datetime import datetime

from com.wanhe.common.db import Database


class StudentModel:
    """学生表（含选老师、分班、逻辑删除/回收站）数据访问"""

    # ===== 基础 SQL 片段 =====

    def _base_sql(self):
        """
        学生列表基础 SQL（含关联班级名、教师名、选课数子查询）
        :return: (sql, params)：sql 不含 WHERE/ORDER/LIMIT，params 为空列表供追加
        """
        sql = (
            "SELECT s.*, c.name AS class_name, t.name AS teacher_name, "
            "       (SELECT COUNT(*) FROM student_course sc "
            "        WHERE sc.student_id = s.id) AS course_count "
            "FROM students s "
            "LEFT JOIN classes c ON s.class_id = c.id "
            "LEFT JOIN teachers t ON s.teacher_id = t.id "
        )
        params = []
        return sql, params

    def _where_not_deleted(self):
        """返回 is_deleted=0 过滤条件，供各查询方法复用"""
        return "WHERE s.is_deleted = 0 "

    # ===== 正常查询（均过滤 is_deleted=0） =====

    def get_all(self, keyword=''):
        """
        查询所有未删除学生（关联班级名、教师名、选课数），可按姓名模糊查询
        回收站数据（is_deleted=1）不会被查出来
        :param keyword: 姓名关键字（可选，为空返回全部）
        :return: 学生行字典列表
        """
        sql, params = self._base_sql()
        sql += self._where_not_deleted()
        if keyword:
            sql += "AND s.name LIKE %s "
            params.append(f"%{keyword}%")
        sql += "ORDER BY s.id"
        with Database() as db:
            return db.query_all(sql, tuple(params))

    def get_page(self, keyword='', page=1, page_size=10):
        """
        分页查询未删除学生，返回 {"total": int, "items": [...]}
        回收站数据（is_deleted=1）不会被查出来
        :param keyword: 姓名关键字（可选）
        :param page: 页码（>=1，自动钳制）
        :param page_size: 每页条数（1~100，自动钳制）
        :return: {"total": 总条数, "items": 当前页学生列表}
        """
        # 参数下限/上限钳制，防止非法输入
        page = max(1, page)
        page_size = max(1, min(100, page_size))
        base_sql, params = self._base_sql()
        where = self._where_not_deleted()
        if keyword:
            where += "AND s.name LIKE %s "
            params.append(f"%{keyword}%")
        with Database() as db:
            # 1. 统计总数（与列表同一 WHERE，保证 total 与 items 一致）
            total = db.query_one(
                "SELECT COUNT(*) AS cnt FROM students s " + where,
                tuple(params)
            )["cnt"]
            # 2. 查询当前页数据（LIMIT/OFFSET 分页）
            items = db.query_all(
                base_sql + where + "ORDER BY s.id LIMIT %s OFFSET %s",
                tuple(params) + ((page_size, (page - 1) * page_size))
            )
            return {"total": total, "items": items}

    def get_by_id(self, student_id, show_deleted=False):
        """
        按 ID 查询学生（含班级名、教师名）
        :param student_id: 学生 ID
        :param show_deleted: 是否查询回收站数据（默认 False，只查未删除的）
        :return: 学生行 dict；不存在返回 None
        """
        with Database() as db:
            sql = (
                "SELECT s.*, c.name AS class_name, t.name AS teacher_name "
                "FROM students s "
                "LEFT JOIN classes c ON s.class_id = c.id "
                "LEFT JOIN teachers t ON s.teacher_id = t.id "
                "WHERE s.id = %s"
            )
            # 默认不查询回收站数据，除非显式传 show_deleted=True
            if not show_deleted:
                sql += " AND s.is_deleted = 0"
            return db.query_one(sql, (student_id,))

    # ===== 新增 =====

    def create(self, name, gender, age, grade, class_id, teacher_id, enrollment_date):
        """
        新增学生（is_deleted 默认为 0）
        :return: 新学生自增 ID
        """
        with Database() as db:
            return db.insert(
                "INSERT INTO students (name, gender, age, grade, class_id, teacher_id, enrollment_date) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                (name, gender, age, grade, class_id, teacher_id, enrollment_date)
            )

    # ===== 修改（仅允许操作未删除的学生） =====

    def update(self, student_id, name, gender, age, grade):
        """
        修改学生基本信息（姓名/性别/年龄/年级），仅限未删除的学生
        :return: 受影响行数
        """
        with Database() as db:
            return db.execute(
                "UPDATE students SET name=%s, gender=%s, age=%s, grade=%s "
                "WHERE id=%s AND is_deleted=0",
                (name, gender, age, grade, student_id)
            )

    def change_class(self, student_id, class_id):
        """
        分班：把学生安排到指定班级，仅限未删除的学生
        :return: 受影响行数
        """
        with Database() as db:
            return db.execute(
                "UPDATE students SET class_id=%s WHERE id=%s AND is_deleted=0",
                (class_id, student_id)
            )

    def change_teacher(self, student_id, teacher_id):
        """
        选老师：把学生分配给指定教师，仅限未删除的学生
        :return: 受影响行数
        """
        with Database() as db:
            return db.execute(
                "UPDATE students SET teacher_id=%s WHERE id=%s AND is_deleted=0",
                (teacher_id, student_id)
            )

    # ===== 逻辑删除（移入回收站） =====

    def logic_delete(self, student_id, operator):
        """
        逻辑删除：标记 is_deleted=1，记录删除时间和操作人
        不真实删除数据，学生进入回收站
        :param student_id: 学生 ID
        :param operator: 操作人用户名
        :return: 受影响行数（1 表示成功，0 表示学生不存在或已删除）
        """
        with Database() as db:
            return db.execute(
                "UPDATE students SET is_deleted=1, delete_time=%s, delete_operator=%s "
                "WHERE id=%s AND is_deleted=0",
                (datetime.now(), operator, student_id)
            )

    # ===== 恢复（从回收站还原） =====

    def recover_student(self, student_id):
        """
        从回收站恢复学生：清除删除标记
        :param student_id: 学生 ID
        :return: 受影响行数（1 表示成功，0 表示学生不在回收站）
        """
        with Database() as db:
            return db.execute(
                "UPDATE students SET is_deleted=0, delete_time=NULL, delete_operator=NULL "
                "WHERE id=%s AND is_deleted=1",
                (student_id,)
            )

    # ===== 真实删除（物理删除，不可恢复） =====

    def real_delete(self, student_id):
        """
        真实删除（物理删除）：同时清理选课记录和关联账号，不可恢复
        仅删除回收站中的数据（is_deleted=1），防止误删正常数据
        :param student_id: 学生 ID
        :return: 删除的学生行数（0 表示学生不在回收站，拒绝物理删除）
        """
        with Database() as db:
            # 先确认学生确实在回收站中，防止误删正常数据
            student = db.query_one(
                "SELECT id FROM students WHERE id=%s AND is_deleted=1",
                (student_id,)
            )
            if student is None:
                return 0  # 不在回收站，拒绝删除

            db.execute("DELETE FROM student_course WHERE student_id = %s", (student_id,))
            db.execute("DELETE FROM users WHERE student_id = %s", (student_id,))
            return db.execute("DELETE FROM students WHERE id = %s AND is_deleted=1", (student_id,))

    # ===== 回收站列表查询 =====

    def get_recycle_list(self, keyword='', page=1, page_size=10):
        """
        分页查询回收站学生列表（is_deleted=1）
        :param keyword: 姓名关键字（可选）
        :param page: 页码（>=1，自动钳制）
        :param page_size: 每页条数（1~100，自动钳制）
        :return: {"total": 总条数, "items": 回收站学生列表}
        """
        page = max(1, page)
        page_size = max(1, min(100, page_size))
        base_sql, params = self._base_sql()
        where = "WHERE s.is_deleted = 1 "
        if keyword:
            where += "AND s.name LIKE %s "
            params.append(f"%{keyword}%")
        with Database() as db:
            total = db.query_one(
                "SELECT COUNT(*) AS cnt FROM students s " + where,
                tuple(params)
            )["cnt"]
            items = db.query_all(
                base_sql + where + "ORDER BY s.delete_time DESC LIMIT %s OFFSET %s",
                tuple(params) + ((page_size, (page - 1) * page_size))
            )
            return {"total": total, "items": items}
