# 文件名：main.py
"""
EAMS 学校教务管理系统 - 程序入口

功能：学生/教师管理、学生选课、学生分班、学生自主注册登录
运行（Windows 本地）：
  开发：uvicorn main:app --reload
  也可：python main.py

组装流程：创建 FastAPI 实例 → 挂载静态页 → 注册日志中间件/异常处理 → 挂载 7 个业务模块路由（auth/student/teacher/classes/course/stats/zhicheng）
"""
import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

# 导入各业务模块子路由（每个模块一个 APIRouter）
from com.wanhe.auth.router import router as auth_router       # 认证（公开）
from com.wanhe.student.router import router as student_router   # 学生
from com.wanhe.teacher.router import router as teacher_router   # 教师
from com.wanhe.classes.router import router as classes_router   # 班级
from com.wanhe.course.router import router as course_router     # 课程/选课
from com.wanhe.stats.router import router as stats_router       # 统计分析
from com.wanhe.zhicheng.router import router as zhicheng_router # 职称

# 导入公共模块（日志配置需在启动时加载，供各业务模块 logger 使用）
import com.wanhe.common.logging  # noqa: F401
from com.wanhe.common.exceptions import register_exception_handlers

# 实例化 FastAPI 主程序
app = FastAPI(
    title="EAMS 学校教务管理系统",
    description="学生/教师管理、选课、分班、注册登录一体化 API",
    version="1.0.0",
)

# 项目根目录（挂载静态页用绝对路径，避免切换目录找不到）
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# 挂载静态页面（登录/注册/管理后台，由后端直接提供）
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

# 注册全局异常处理（统一错误返回格式 {code, msg, data}）
register_exception_handlers(app)

# 挂载所有模块化路由
app.include_router(auth_router)
app.include_router(student_router)
app.include_router(teacher_router)
app.include_router(classes_router)
app.include_router(course_router)
app.include_router(stats_router)
app.include_router(zhicheng_router)


# 根路径：重定向到登录页面
@app.get("/")  # 路由装饰器：注册根路径 GET 接口，重定向到登录页
def root():
    return RedirectResponse(url="/static/login.html")


# 本地直接运行入口（Windows 开发环境热重载）
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
