# 文件名：classes/model.py
"""
班级模块 - 数据访问层

职责：封装 classes 表 SQL 操作（增删改查 + 按班级名关键字查询，关联班主任姓名）
依赖：common.db.Database
"""
from com.wanhe.common.db import Database


class ClassModel:
    """班级表（分班）数据访问"""

    def count_students(self, class_id):
        """
        统计班级下的学生数（删除前校验使用）
        :param class_id: 班级 ID
        :return: 学生数量（int）
        """
        with Database() as db:
            row = db.query_one(
                "SELECT COUNT(*) AS cnt FROM students WHERE class_id = %s AND is_deleted = 0",
                (class_id,)
            )
            return int(row["cnt"]) if row else 0

    def is_head_teacher_taken(self, teacher_id, exclude_class_id=None):
        """
        判断某教师是否已被其他班级占用为班主任
        :param teacher_id: 教师 ID
        :param exclude_class_id: 排除的班级 ID（编辑自身时使用）
        :return: True 表示已被占用
        """
        if teacher_id is None:
            return False
        sql = "SELECT 1 FROM classes WHERE head_teacher_id = %s"
        params = [teacher_id]
        if exclude_class_id is not None:
            sql += " AND id != %s"
            params.append(exclude_class_id)
        sql += " LIMIT 1"
        with Database() as db:
            return db.query_one(sql, tuple(params)) is not None

    def _page_base_sql(self):
        """
        分页列表基础 SQL（含 head_teacher_name 关联）
        :return: (sql, params) — sql 不含 WHERE/ORDER/LIMIT，params 为空列表
        """
        sql = (
            "SELECT c.*, t.name AS head_teacher_name "
            "FROM classes c LEFT JOIN teachers t ON c.head_teacher_id = t.id "
        )
        return sql, []

    def get_page(self, keyword='', grade='', page=1, page_size=10):
        """
        分页查询班级列表
        :param keyword: 班级名关键字（可选）
        :param grade: 年级精确过滤（可选）
        :param page: 页码（>=1，自动钳制）
        :param page_size: 每页条数（1~100，自动钳制）
        :return: {"total": int, "items": [dict, ...]}
        """
        page = max(1, page)
        page_size = max(1, min(100, page_size))
        base_sql, params = self._page_base_sql()
        where_parts = []
        if keyword:
            where_parts.append("c.name LIKE %s")
            params.append(f"%{keyword}%")
        if grade:
            where_parts.append("c.grade = %s")
            params.append(grade)
        where = ("WHERE " + " AND ".join(where_parts) + " ") if where_parts else ""
        with Database() as db:
            total = db.query_one(
                "SELECT COUNT(*) AS cnt FROM classes c " + where,
                tuple(params)
            )["cnt"]
            items = db.query_all(
                base_sql + where + "ORDER BY c.id LIMIT %s OFFSET %s",
                tuple(params) + (page_size, (page - 1) * page_size)
            )
            return {"total": total, "items": items}

    def get_detail(self, class_id):
        """
        获取班级详情（班级 + 班主任 + 学生名单 + 男女统计）
        :param class_id: 班级 ID
        :return: dict；班级不存在返回 None
        """
        with Database() as db:
            cls = db.query_one(
                "SELECT c.*, t.name AS head_teacher_name "
                "FROM classes c LEFT JOIN teachers t ON c.head_teacher_id = t.id "
                "WHERE c.id = %s",
                (class_id,)
            )
            if cls is None:
                return None

            students = db.query_all(
                "SELECT id, name, gender, age, enrollment_date "
                "FROM students WHERE class_id = %s AND is_deleted = 0 ORDER BY id",
                (class_id,)
            )

            gender_rows = db.query_all(
                "SELECT gender, COUNT(*) AS cnt FROM students "
                "WHERE class_id = %s AND is_deleted = 0 GROUP BY gender",
                (class_id,)
            )
            gender_stats = {row["gender"] or "未知": int(row["cnt"]) for row in gender_rows}

            head_teacher = None
            if cls.get("head_teacher_id"):
                head_teacher = db.query_one(
                    "SELECT id, name, gender, age, subject, phone FROM teachers WHERE id = %s",
                    (cls["head_teacher_id"],)
                )

            return {
                "class": cls,
                "head_teacher": head_teacher,
                "students": students,
                "student_count": len(students),
                "gender_stats": gender_stats,
            }

    def get_all(self, keyword=''):
        """
        查询所有班级（关联班主任姓名），可按班级名模糊查询
        :param keyword: 班级名关键字（可选）
        :return: 班级行字典列表（含 head_teacher_name、在校学生数）
        """
        sql = (
            "SELECT c.*, t.name AS head_teacher_name, "
            "       (SELECT COUNT(*) FROM students s "
            "        WHERE s.class_id = c.id AND s.is_deleted = 0) AS student_count "
            "FROM classes c LEFT JOIN teachers t ON c.head_teacher_id = t.id "
        )
        params = []
        if keyword:
            sql += "WHERE c.name LIKE %s "
            params.append(f"%{keyword}%")
        sql += "ORDER BY c.id"
        with Database() as db:
            return db.query_all(sql, tuple(params))

    def get_by_id(self, class_id):
        """
        按 ID 查询班级
        :param class_id: 班级 ID
        :return: 班级行 dict；不存在返回 None
        """
        with Database() as db:
            return db.query_one("SELECT * FROM classes WHERE id = %s", (class_id,))

    def create(self, name, grade, head_teacher_id):
        """
        新增班级
        :return: 新班级自增 ID
        """
        with Database() as db:
            return db.insert(
                "INSERT INTO classes (name, grade, head_teacher_id) VALUES (%s, %s, %s)",
                (name, grade, head_teacher_id)
            )

    def update(self, class_id, name, grade, head_teacher_id):
        """
        修改班级
        :return: 受影响行数
        """
        with Database() as db:
            return db.execute(
                "UPDATE classes SET name=%s, grade=%s, head_teacher_id=%s WHERE id=%s",
                (name, grade, head_teacher_id, class_id)
            )

    def delete(self, class_id):
        """
        删除班级（同时清空所属学生的班级引用）
        :return: 受影响行数
        """
        with Database() as db:
            db.execute(
                "UPDATE students SET class_id = NULL WHERE class_id = %s",
                (class_id,)
            )
            return db.execute("DELETE FROM classes WHERE id = %s", (class_id,))

    def unbind_mismatched_students(self, class_id, new_grade):
        """
        班级改年级后，清空该班中年级与班级不匹配学生的分班
        （班级年级固定，学生年级与班级年级须一致）
        :return: 受影响行数
        """
        with Database() as db:
            return db.execute(
                "UPDATE students SET class_id = NULL "
                "WHERE class_id = %s AND grade <> %s AND is_deleted = 0",
                (class_id, new_grade)
            )
