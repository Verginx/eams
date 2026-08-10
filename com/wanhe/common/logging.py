# 文件名：common/logging.py
"""
日志配置（公共模块）：app.log 按天滚动，保留 7 天；控制台 + 文件双输出
"""
import os
import logging
from logging.handlers import TimedRotatingFileHandler

# 日志目录（项目根 logs/；按天滚动文件落在其中）
LOG_DIR = "logs"
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, "app.log")

# 按天滚动文件处理器：每天午夜切换新文件，保留最近 7 天
file_handler = TimedRotatingFileHandler(
    LOG_FILE, when="midnight", interval=1, backupCount=7, encoding="utf-8"
)
file_handler.suffix = "%Y-%m-%d.log"
file_handler.setFormatter(logging.Formatter(
    "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
))

# 控制台输出
console_handler = logging.StreamHandler()
console_handler.setFormatter(logging.Formatter(
    "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
))

logging.basicConfig(
    level=logging.INFO,
    handlers=[file_handler, console_handler],
)
