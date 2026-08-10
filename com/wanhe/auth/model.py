# 文件名：auth/model.py
"""
认证模块 - 数据访问层

职责：封装 users 表的 SQL 操作（按用户名查用户、创建用户）
依赖：common.db.Database
"""
from com.wanhe.common.db import Database


class UserModel:
    """用户表（注册/登录）数据访问"""

    def find_by_username(self, username):
        """
        根据用户名查询用户（登录时用）
        :param username: 用户名
        :return: 用户行 dict（含 id/username/password/role/student_id）；不存在返回 None
        """
        with Database() as db:
            return db.query_one(
                "SELECT * FROM users WHERE username = %s", (username,)
            )

    def create(self, username, password, role='student', student_id=None):
        """
        注册用户，返回新用户 ID
        :param username: 用户名
        :param password: 密码（教学演示明文存储）
        :param role: 角色（默认 student）
        :param student_id: 关联学生 ID（学生角色时使用，可为 None）
        :return: 新用户自增 ID
        """
        with Database() as db:
            return db.insert(
                "INSERT INTO users (username, password, role, student_id) "
                "VALUES (%s, %s, %s, %s)",
                (username, password, role, student_id)
            )