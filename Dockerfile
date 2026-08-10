# EAMS 学校教务管理系统 - 后端镜像构建说明

# ===== FROM：基础镜像 =====
# 使用 python 3.14 slim（含 Python 环境与 pip，无需手动安装）
FROM python:3.14-slim

# ===== WORKDIR：容器工作目录 =====
WORKDIR /app

# ===== COPY requirements.txt + RUN 安装依赖 =====
# 先复制依赖清单再安装，利用 Docker 层缓存（requirements 不变则跳过重复安装）
COPY requirements.txt .
# -i 指定清华镜像源，国内下载快
RUN pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# ===== COPY 项目代码 =====
# 后端业务模块 + 公共模块
COPY com/ com/
# 前端页面与资源
COPY static/ static/
# 程序入口
COPY main.py .
# 建库建表脚本（供 MySQL 容器挂载初始化用）
COPY init.sql .

# ===== EXPOSE：声明端口 =====
EXPOSE 8000

# ===== CMD：容器启动命令 =====
# 启动 uvicorn，监听 0.0.0.0 使容器外可访问
# DB_HOST 等数据库配置由 docker run 时通过 -e 环境变量注入（覆盖 config.py 默认值）
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
