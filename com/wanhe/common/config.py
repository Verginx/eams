# 文件名：common/config.py
"""
公共模块 - 应用配置

职责：从环境变量 / 项目根 .env 读取数据库连接配置
使用 pydantic-settings：字段名与环境变量同名（大小写不敏感），环境变量优先于 .env
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """全局配置：字段名与 .env 环境变量同名映射（大小写不敏感）"""

    # ---- 数据库 ----
    db_host: str = "127.0.0.1"   # 数据库地址（本机部署）
    db_port: int = 3306          # 端口
    db_user: str = "root"        # 用户名
    db_password: str = ""        # 密码（必须通过环境变量或 .env 提供，不再内置默认值）
    db_name: str = "school_db"   # 数据库名

    # 读取配置：优先环境变量，其次项目根 .env 文件
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


# 模块级单例：各模块 import settings 即取用
settings = Settings()
