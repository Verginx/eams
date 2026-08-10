# Docker 部署手册（EAMS）

| 项目 | EAMS 学校教务管理系统 |
|------|----------------------|
| 文档编号 | EAMS-DOC-17 |
| 文档版本 | V1.0 |
| 密级 | 内部 |
| 编写人 | 项目组 |
| 编写日期 | 2026-08-10 |
| 修订记录 | V1.0 初稿 |

---

## 1. 概述

本文档说明如何使用 Docker 部署 EAMS（FastAPI + MySQL 8.0），采用**手动 `docker run` 逐条命令**方式，便于理解容器原理。

**架构**：
```
浏览器
  │
  ▼
eams-web 容器（FastAPI :8000）──(容器名 mysql)──► mysql 容器（MySQL 8.0 :3306）
     │
     └─ 同一 Docker 网络 eams-net，通过容器名互访
```

## 2. 环境准备

- Linux 服务器（如 Ubuntu 22.04）或带 Docker 的机器
- 已安装 Docker（`docker --version` 验证）
- 国内环境建议配置镜像加速（Docker 官方文档或常见镜像加速站）

## 3. 项目适配说明（重要）

本项目 `common/config.py` 使用 **pydantic-settings**，**环境变量优先于 .env**。因此**无需修改代码**，只需在启动容器时通过 `-e DB_HOST=mysql` 注入数据库地址即可：

| 配置项 | 本机（Windows） | Docker 容器内 |
|--------|----------------|---------------|
| DB_HOST | 127.0.0.1 | `mysql`（容器名） |
| DB_PASSWORD | 150259 | 150259（与 MySQL 容器一致） |
| DB_NAME | school_db | school_db |

## 4. 构建 Web 镜像

在项目根目录执行：

```bash
# 构建镜像（读取 Dockerfile）
docker build -t eams-web:1.0 .

# 查看镜像
docker images eams-web:1.0
```

`Dockerfile` 内容：基于 `python:3.14-slim`，安装 `requirements.txt` 依赖，复制 `com/`（业务模块）、`static/`（前端）、`main.py`（入口）、`init.sql`（建表脚本）。

## 5. 逐条命令部署

### 5.1 创建 Docker 网络

```bash
docker network create eams-net
# 验证
docker network ls | grep eams-net
```

> 网络让 eams-web 与 mysql 两个容器能通过**容器名**互访。

### 5.2 启动 MySQL 容器

```bash
docker run -d \
  --name mysql \
  --network eams-net \
  -p 3306:3306 \
  -v mysql-data:/var/lib/mysql \
  -v "$(pwd)"/init.sql:/docker-entrypoint-initdb.d/init.sql \
  -e MYSQL_ROOT_PASSWORD=150259 \
  mysql:8.0 --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
```

| 参数 | 说明 |
|------|------|
| `-d` | 后台运行 |
| `--name mysql` | 容器名（也是网络中 MySQL 的主机名） |
| `--network eams-net` | 加入 eams-net 网络 |
| `-p 3306:3306` | 端口映射（外部可访问 MySQL） |
| `-v mysql-data:/var/lib/mysql` | 数据卷，容器删除数据不丢 |
| `-v init.sql:...` | 首次启动自动执行建库建表 + 种子数据 |
| `-e MYSQL_ROOT_PASSWORD=150259` | MySQL root 密码 |
| `--character-set-server=utf8mb4` | 中文字符集 |

**等待就绪**：

```bash
# 看到 "ready for connections" 表示就绪
docker logs mysql

# 验证表已创建
docker exec -it mysql mysql -uroot -p150259 school_db -e "SHOW TABLES;"
```

### 5.3 启动 Web 容器

```bash
docker run -d \
  --name eams-web \
  --network eams-net \
  -p 8000:8000 \
  -e DB_HOST=mysql \
  -e DB_PORT=3306 \
  -e DB_USER=root \
  -e DB_PASSWORD=150259 \
  -e DB_NAME=school_db \
  eams-web:1.0
```

| 参数 | 说明 |
|------|------|
| `--name eams-web` | 容器名 |
| `--network eams-net` | 与 MySQL 同一网络，才能用 `DB_HOST=mysql` 访问 |
| `-p 8000:8000` | 映射端口 |
| `-e DB_HOST=mysql` | 数据库主机名指向 MySQL 容器（覆盖 config 默认 127.0.0.1） |
| 其余 `-e` | 数据库端口/账号/密码/库名 |

## 6. 验证

```bash
# 1. 查看运行中的容器
docker ps

# 2. 查看 Web 日志（确认连接数据库成功）
docker logs eams-web

# 3. 接口测试
curl http://localhost:8000/students/all

# 4. 浏览器访问（换成你的服务器 IP）
http://<服务器IP>:8000
```

看到返回 JSON 数据即表示 Web 已成功连接 MySQL。

## 7. 常见问题

| 问题 | 处理 |
|------|------|
| Web 连不上 MySQL | MySQL 未就绪。`docker restart eams-web`；或启动时加 `--restart on-failure` |
| 端口被占用 | 换映射端口（如 `-p 8001:8000`） |
| 中文乱码 | 确认 MySQL 启动参数含 `--character-set-server=utf8mb4` |

## 8. 升级部署（代码变更后）

```bash
# 1. 停止并删除旧容器（数据卷 mysql-data 不丢）
docker stop eams-web && docker rm eams-web

# 2. 重新构建镜像
cd /项目根
docker build -t eams-web:1.0 .

# 3. 重新启动（命令同 5.3）
docker run -d --name eams-web --network eams-net -p 8000:8000 \
  -e DB_HOST=mysql -e DB_PORT=3306 -e DB_USER=root -e DB_PASSWORD=150259 -e DB_NAME=school_db \
  eams-web:1.0
```

## 9. 关联文档

- [部署与运行手册（Windows 本地）](../04-部署与交付/11-部署与运行手册.md)
