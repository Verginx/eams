# 使用 Git 管理项目版本（PyCharm 2025.2 集成指南）

| 项目 | EAMS 学校教务管理系统 |
|------|----------------------|
| 文档编号 | EAMS-DOC-19 |
| 文档版本 | V1.0 |
| 密级 | 内部 |
| 编写人 | 项目组 |
| 编写日期 | 2026-08-10 |
| 修订记录 | V1.0 初稿 |

---

## 1. 概述

本文档说明如何在 **Windows + PyCharm 2025.2** 环境中，使用本机安装的 Git（`D:\Git\`）对 EAMS 项目做代码版本管理，并推送到线上代码托管平台（GitHub / Gitee）实现团队协作与云端备份。

整体流程：PyCharm 配置本机 Git → 项目初始化本地仓库 → 配置 `.gitignore` → 本地提交（Commit） → 关联线上仓库 → 推送 / 拉取（Push/Pull） → 换机克隆。

> 核心概念一句话：本地 Git 负责记录版本历史，线上仓库负责备份与共享。PyCharm 只是把 Git 命令变成图形化按钮。

| 组件 | 版本要求 | 说明 |
|------|---------|------|
| Windows | 10/11 | 本项目运行平台 |
| PyCharm | 2025.2（Community 或 Professional 均可） | 内置 Git 集成，无需额外插件 |
| Git | 2.x（本机已装 2.55.0，路径 `D:\Git\`） | 项目版本管理工具 |
| 线上平台 | GitHub 或 Gitee 账号 | 托管远程仓库 |
| 科学上网 | - | 如果有科学上网速度比较快 |

## 2. 环境准备

验证本机 Git 已装好（PyCharm 底部 Terminal 输入）：

```bash
git --version
# 输出：git version 2.55.0.windows.3
```

> 若没有输出，说明 Git 未安装或未加入 PATH。本项目已安装于 `D:\Git\`，第 3 章直接手动指定路径即可，无需依赖 PATH。

## 3. PyCharm 配置本机 Git（只配一次）

### 3.1 指定 Git 可执行文件路径

1. 打开 PyCharm，File → Settings（新 UI：右上角齿轮 ⚙ → Settings）
2. 左侧展开 **Version Control → Git**
3. 右侧 **Path to Git executable** 填：`D:\Git\bin\git.exe`（也可点浏览按钮选择）
4. 点 **Test** 按钮，弹出 `Git executed successfully` 即配置成功
5. 点 **OK** 保存

> 只有自动检测不到时才需要手动填路径。配置一次后全局生效，后续项目都可用。

### 3.2 配置 Git 用户信息（首次提交前必做）

Git 每次提交都要记录「谁提交的」，否则提交会报错 `Please tell me who you are`。

方式一：Terminal 命令（推荐，一劳永逸）

```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱@example.com"
```

## 4. 为项目启用 Git（初始化本地仓库）

打开 EAMS 项目后：

1. 顶部菜单 **VCS → Enable Version Control Integration…**
2. 版本控制类型选择 **Git**，点 **OK**
3. 项目根目录自动生成 `.git/` 文件夹（版本历史库），PyCharm 顶部出现 Git 菜单 / 右侧 Git 工具栏

命令行替代：

```bash
cd D:\workspace-pycharm\eams
git init
```

> 初始化后即可随时本地提交保存版本。此时还没关联线上仓库，纯本地管理。

## 5. 配置 .gitignore（忽略无需管理的文件）

Git 会「盯着」项目里每个文件，但有些文件不应该进版本库（体积大 / 可再生 / 含敏感信息）。

项目根目录已创建 `.gitignore`，内容如下：

```gitignore
.venv/
__pycache__/
*.py[cod]
logs/
*.log
.idea/
.env
```

| 忽略项 | 原因 |
|--------|------|
| `.venv/` | Python 虚拟环境，体积大、可再生，可重建 |
| `__pycache__/`、`*.py[cod]` | Python 字节码缓存 |
| `logs/`、`*.log` | 运行日志 |
| `.idea/` | PyCharm 工程配置（含本机路径） |
| `.env` | 数据库密码等敏感配置，团队各自建 |

> `.env` 不进版本库后，换机 / 克隆需手动创建（参考《部署与运行手册》第 2 章模板）。务必在首次提交前配好 `.gitignore`，否则 `.venv` 一旦被提交，后面要单独删除（见第 12 章 FAQ）。

## 6. 本地提交（Commit）—— 保存版本快照

1. 修改代码后，PyCharm 右侧会出现 Commit 工具窗口（也可按快捷键，或菜单 **Git → Commit…**）
2. Commit 面板列出变更文件，勾选要提交的文件（默认全选）
3. 下方填写提交说明（Message），格式建议：`类型: 简述`，如 `feat: 新增学生分页接口`、`fix: 修复登录报错`、`docs: 更新部署文档`
4. 点 **Commit**（或 Commit and Push，提交后直接推送到远程）

命令行替代：

```bash
git add .                                        # 暂存所有变更
git commit -m "feat: 新增学生分页接口"           # 提交并写说明
```

> 提交是把当前代码「拍照存档」，随时可回退到任意一次提交。建议功能做完一个小步就提交一次，说明写清楚改了什么。

## 7. 关联远程仓库（实现线上代码管理）

### 7.1 创建线上空仓库

GitHub：登录 github.com → New repository → 填仓库名（如 `eams`） → 不要勾选 "Add a README / .gitignore"（保持空仓库） → Create

记下仓库地址（HTTPS 形式），形如：

```
https://github.com/你的用户名/eams.git
```

### 7.2 在 PyCharm 添加远程仓库

1. 顶部菜单 **Git → Manage Remotes…**（或 Settings → Version Control → Git → Remotes）
2. 点 ＋，Name 填 `origin`（约定俗成的默认远程名），URL 粘贴上一步仓库地址，点 **OK**

命令行替代：

```bash
git remote add origin https://github.com/你的用户名/eams.git
git remote -v    # 查看已配置的远程
```

### 7.3 首次推送到线上

1. 顶部菜单 **Git → Push…**（或快捷键 `Ctrl+Shift+K`）
2. 首次推送会弹出认证窗口：
   - GitHub：选择 **Log in via GitHub**（浏览器授权）或 **Log in with Token**（Settings → Version Control → GitHub 里 Add account 用 Token 登录）
   - 把生成的 token 填写到 "Add Account" 界面，点击按钮完成账号添加
3. 点 **Push**，提示 **"Push successful"** 即线上已同步

推送成功后，去 GitHub/Gitee 页面刷新即可看到全部源码 —— 这就是线上代码管理。

命令行替代：

```bash
git push -u origin master    # -u：记住关联，以后直接 git push
# 线上默认分支若是 main，则 git push -u origin main
```

## 8. 日常流程：提交 → 推送 → 拉取

开发节奏（每天循环）：

```
编辑代码 → Commit（存本地版本） → Push（同步线上）
                    ↑
     Pull（拉取队友最新代码）可穿插在任何一步前
```

- 推送（本机 → 线上）：Git → Push / `Ctrl+Shift+K`（等价 `git push`）
- 拉取（线上 → 本机）：Git → Pull / `Ctrl+T`（等价 `git pull`，会先抓取再合并）

> 最佳实践：每次开始写代码前先 Pull 一次，把队友的改动拉到本地，减少后面冲突。多人协作时冲突不可避免，冲突时 PyCharm 会弹出合并对话框，手动保留两侧内容后点 **Merge**（详见第 12 章）。

## 9. 换机克隆（把线上代码拉回新电脑）

换电脑 / 重装系统时，从线上仓库直接克隆（无需拷贝 `.venv`）：

1. 新电脑 PyCharm 按第 3 章配好 Git
2. File → New → Project from Version Control…（或欢迎页 Get from VCS）
3. URL 填线上仓库地址，Directory 选本地目录，点 **Clone**
4. 打开项目后，创建虚拟环境 + 安装依赖 + 建库 + 配 `.env`（见《项目迁移文档》第 4 章）

命令行替代：

```bash
git clone https://github.com/你的用户名/eams.git
```

> 克隆下来的代码天然不含 `.venv`、`.env`、`logs` 等（`.gitignore` 已排除），干净可用。后续 `Ctrl+T` 拉取即可拿到最新代码。

## 10. 查看历史与版本回退

- 查看历史：顶部菜单 **Git → Show History**，或左下角 Git 工具窗口 → **Log**（`Alt+9`），可看到每次提交的记录、作者、时间、改动文件
- 对比改动：Log 里选中某次提交 → 右键 → **Show Diff** 查看该次改了什么
- 回退到某版本：
  - 软回退（保留工作区）：Log 选中目标提交 → 右键 → **Reset Current Branch…** → Soft，代码保持当前状态但版本指针回退
  - 放弃本地改动：Git 工具窗口 **Local Changes** 面板 → 右键文件 → **Revert**，回到最近一次提交的状态

> 教学提示：回退前先确认自己的改动已提交或备份，误操作可用 `git reflog` 找回，但请谨慎使用回退。

## 11. 分支管理（进阶，可选）

| 操作 | PyCharm 菜单 | 命令 |
|------|-------------|------|
| 新建分支 | Git → Branches → New Branch… | `git checkout -b feature-xxx` |
| 切换分支 | Git → Branches 里点分支名 | `git checkout 分支名` |
| 合并分支 | Git → Branches → Merge into Current… | `git merge 分支名` |

> 单人开发建议直接在 `master/main` 上提交即可；多人协作可为主分支外建 `develop`、`feature-*` 分支，功能完成后合并回主分支。

## 12. 常见问题

| 问题 | 处理 |
|------|------|
| 提交报 `Please tell me who you are` | 按 3.2 配置 `user.name` / `user.email` |
| 推送报认证失败 / 403 | GitHub 用 Token 或浏览器登录；Gitee 检查用户名密码；凭证错误时在 Windows 凭据管理器删除旧凭据重试 |
| 推送报 Failed to connect / 443 超时 | 国内网络问题：改用 Gitee 仓库；或在 Git 设置中配置代理 |
| Pull 提示冲突 | PyCharm 弹出合并对话框：红色两侧分别显示「我的 / 对方的」，选择保留或手改后点 Apply，再 Commit |
| 提示 `LF will be replaced by CRLF` | 换行符警告，可忽略；或 `git config --global core.autocrlf true` |
| 不小心把 `.venv` 提交了 | 加 `.gitignore` 后执行 `git rm -r --cached .venv`，再提交推送（只删版本库记录，本地文件保留） |
| 推送提示 master/main 分支名不一致 | 按线上默认分支名推送：`git push -u origin main` |
| 忘记远程地址 | `git remote -v` 查看；改地址 `git remote set-url origin 新地址` |

## 13. 关联文档

- [项目迁移文档](./项目迁移文档.md)
- [部署与运行手册](./11-部署与运行手册.md)
