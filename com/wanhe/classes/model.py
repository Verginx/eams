# 文件名：classes/model.py
"""
班级模块 - 数据访问层

职责：封装 classes 表 SQL 操作（增删改查 + 按班级名关键字查询，关联班主任姓名）
依赖：common.db.Database
"""
from com.wanhe.common.db import Database


class ClassModel:
    """班级表（分班）数据访问"""

    def get_all(self, keyword=''):
        """
        查询所有班级（关联班主任姓名），可按班级名模糊查询
        :param keyword: 班级名关键字（可选）
        :return: 班级行字典列表（含 head_teacher_name）
        """
        sql = (
            "SELECT c.*, t.name AS head_teacher_name "
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
            db.execute("UPDATE students SET class_id = NULL WHERE class_id = %s", (class_id,))
            return db.execute("DELETE FROM classes WHERE id = %s", (class_id,))