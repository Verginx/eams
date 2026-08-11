# 文件名：zhicheng/model.py
"""
职称模块 - 数据访问层

职责：封装 zhicheng 表 SQL 操作（增删改查 + 按职称名关键字查询）
依赖：common.db.Database（支持 with 语句自动释放连接）
"""
from com.wanhe.common.db import Database


class ZhichengModel:
    """职称表数据访问"""

    def get_all(self, keyword=''):
        """
        查询所有职称（含持有该职称的教师数与教师名），可按职称名模糊查询，按级别倒序排列
        :param keyword: 职称名关键字（可选）
        :return: 职称行字典列表（含 teacher_count / teacher_names）
        """
        sql = (
            "SELECT z.*, "
            "       (SELECT COUNT(*) FROM teachers t "
            "        WHERE t.zhicheng_id = z.id) AS teacher_count, "
            "       (SELECT GROUP_CONCAT(t.name ORDER BY t.id SEPARATOR '、') "
            "        FROM teachers t WHERE t.zhicheng_id = z.id) AS teacher_names "
            "FROM zhicheng z "
        )
        params = []
        if keyword:
            sql += "WHERE z.name LIKE %s "
            params.append(f"%{keyword}%")
        sql += "ORDER BY z.level DESC, z.id"
        with Database() as db:
            # GROUP_CONCAT 默认截断长度 1024 字节，扩到 10KB 避免教师名列表被截断
            db.execute("SET SESSION group_concat_max_len = 10240")
            return db.query_all(sql, tuple(params))

    def get_by_id(self, zhicheng_id):
        """
        按 ID 查询职称
        :param zhicheng_id: 职称 ID
        :return: 职称行 dict；不存在返回 None
        """
        with Database() as db:
            return db.query_one("SELECT * FROM zhicheng WHERE id = %s", (zhicheng_id,))

    def create(self, name, level, description):
        """
        新增职称
        :return: 新职称自增 ID
        """
        with Database() as db:
            return db.insert(
                "INSERT INTO zhicheng (name, level, description) VALUES (%s, %s, %s)",
                (name, level, description)
            )

    def update(self, zhicheng_id, name, level, description):
        """
        修改职称
        :return: 受影响行数
        """
        with Database() as db:
            return db.execute(
                "UPDATE zhicheng SET name=%s, level=%s, description=%s WHERE id=%s",
                (name, level, description, zhicheng_id)
            )

    def delete(self, zhicheng_id):
        """
        删除职称（同时清空持有该职称教师的职称引用）
        :return: 受影响行数
        """
        with Database() as db:
            db.execute("UPDATE teachers SET zhicheng_id = NULL WHERE zhicheng_id = %s", (zhicheng_id,))
            return db.execute("DELETE FROM zhicheng WHERE id = %s", (zhicheng_id,))
