# 文件名：common/db.py
"""
数据库操作封装（仿 database.py）
基于 PyMySQL 实现，提供：连接管理 + 通用的增删改查方法
每次调用新建连接、方法内 commit，无连接池
"""
import pymysql

from com.wanhe.common.config import settings

# ===== 数据库配置（从 .env / settings 读取） =====
DB_CONFIG = {
    'host': settings.db_host,                              # 数据库地址
    'port': settings.db_port,                              # 端口号
    'user': settings.db_user,                              # 用户名
    'password': settings.db_password,                      # 密码
    'database': settings.db_name,                          # 数据库名
    'charset': 'utf8mb4',                                  # 字符编码
    'cursorclass': pymysql.cursors.DictCursor,             # 结果以字典返回
}


class Database:
    """数据库操作封装：每次新建连接，用完 close() 关闭

    支持 with 语句自动释放连接：
        with Database() as db:
            return db.query_all(sql, params)
    """

    def __init__(self):
        """创建数据库连接"""
        self.conn = pymysql.connect(**DB_CONFIG)

    def __enter__(self):
        """进入 with 块时返回自身，供查询使用"""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """退出 with 块时关闭连接（无论是否抛异常）"""
        self.close()
        return False

    def close(self):
        """关闭连接，释放资源"""
        if self.conn:
            self.conn.close()

    # ---------- 通用查询 ----------
    def query_all(self, sql, params=None):
        """查询多条记录，返回字典列表"""
        with self.conn.cursor() as cursor:
            cursor.execute(sql, params or ())
            return cursor.fetchall()

    def query_one(self, sql, params=None):
        """查询单条记录，返回字典或 None"""
        with self.conn.cursor() as cursor:
            cursor.execute(sql, params or ())
            return cursor.fetchone()

    # ---------- 通用增删改 ----------
    def execute(self, sql, params=None):
        """
        执行增删改语句（insert/update/delete）
        返回受影响行数
        """
        with self.conn.cursor() as cursor:
            cursor.execute(sql, params or ())
            self.conn.commit()
            return cursor.rowcount          # 受影响行数

    def insert(self, sql, params=None):
        """插入数据，返回新增记录的 ID"""
        with self.conn.cursor() as cursor:
            cursor.execute(sql, params or ())
            self.conn.commit()
            return cursor.lastrowid         # 自增主键
