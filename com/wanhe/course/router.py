# 文件名：course/router.py
"""
课程模块：课程增删改查 + 学生选课/退课/成绩

职责：
- 定义 /courses 前缀下端点
- 课程 CRUD、学生选课/退课/成绩登记、查询学生已选课程
- 存在性校验（学生/课程不存在抛 404）、重复选课拦截（400）
"""
import logging

from fastapi import APIRouter, HTTPException

from com.wanhe.course.model import CourseModel, StudentCourseModel
from com.wanhe.course.vo import CourseCreate, CourseUpdate, CourseSelect, ScoreUpdate
from com.wanhe.student.model import StudentModel
from com.wanhe.teacher.model import TeacherModel
from com.wanhe.common.response import success

logger = logging.getLogger(__name__)

# 创建子路由
router = APIRouter(prefix="/courses", tags=["课程模块"])


# ---------- 课程管理 ----------

@router.get("/all")  # 路由装饰器：注册 GET 查询接口
def list_courses(keyword: str = ""):
    """查：获取所有课程（含授课教师名、已选人数），可按课程名模糊查询"""
    return success(CourseModel().get_all(keyword))


@router.get("/one/{course_id}")  # 路由装饰器：注册 GET 查询接口
def get_course(course_id: int):
    """查：按 ID 获取单个课程"""
    course = CourseModel().get_by_id(course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="课程不存在")
    return success(course)


@router.get("/status/{course_id}")  # 路由装饰器：注册 GET 查询接口
def get_status(course_id: int):
    """查：查询课程开课状态"""
    course = CourseModel().get_open(course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="课程不存在")
    return success(course)


@router.get("/mode/{course_id}")  # 路由装饰器：注册 GET 查询接口
def get_mode(course_id: int):
    """查：查询课程授课方式"""
    course = CourseModel().get_mode(course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="课程不存在")
    return success(course)


@router.get("/capacity/{course_id}")  # 路由装饰器：注册 GET 查询接口
def get_capacity(course_id: int):
    """查：查询课程人数上限"""
    course = CourseModel().get_capacity(course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="课程不存在")
    return success(course)


@router.post("/add")  # 路由装饰器：注册 POST 新增接口
def add_course(data: CourseCreate):
    """增：新增课程（若指定授课教师，先验证存在）"""
    if data.teacher_id and TeacherModel().get_by_id(data.teacher_id) is None:
        raise HTTPException(status_code=404, detail="授课教师不存在")
    new_id = CourseModel().create(data.name, data.credit, data.teacher_id,
                                  data.status, data.mode, data.max_students)
    logger.info("新增课程 id:%s 名称:%s 状态:%s 方式:%s 上限:%s",
                new_id, data.name, data.status, data.mode, data.max_students)
    return success({"id": new_id}, msg="新增成功")


@router.put("/update/{course_id}")  # 路由装饰器：注册 PUT 修改接口
def update_course(course_id: int, data: CourseUpdate):
    """改：修改课程"""
    if CourseModel().get_by_id(course_id) is None:
        raise HTTPException(status_code=404, detail="课程不存在")
    CourseModel().update(course_id, data.name, data.credit, data.teacher_id,
                          data.status, data.mode, data.max_students)
    logger.info("修改课程 id:%s 状态:%s 方式:%s 上限:%s",
                course_id, data.status, data.mode, data.max_students)
    return success(msg="修改成功")


@router.delete("/del/{course_id}")  # 路由装饰器：注册 DELETE 删除接口
def delete_course(course_id: int):
    """删：删除课程（若会使某学生降到 0 门课程则阻止删除）"""
    if CourseModel().get_by_id(course_id) is None:
        raise HTTPException(status_code=404, detail="课程不存在")
    only_students = StudentCourseModel().students_with_only_this_course(course_id)
    if only_students:
        names = "、".join(s["student_name"] for s in only_students)
        raise HTTPException(status_code=400,
                            detail=f"该课程是{names}等学生的唯一课程，删除后他们将无课可选，禁止删除")
    CourseModel().delete(course_id)
    logger.info("删除课程 id:%s", course_id)
    return success(msg="删除成功")


# ---------- 学生选课 ----------

@router.get("/student/{student_id}")  # 路由装饰器：注册 GET 查询接口
def get_student_courses(student_id: int):
    """查：查询某学生已选的课程"""
    if StudentModel().get_by_id(student_id) is None:
        raise HTTPException(status_code=404, detail="学生不存在")
    return success(StudentCourseModel().get_courses_by_student(student_id))


@router.get("/students/{course_id}")  # 路由装饰器：注册 GET 查询接口
def get_course_students(course_id: int):
    """查：查询某课程已选的学生（含成绩），供成绩登记使用"""
    if CourseModel().get_by_id(course_id) is None:
        raise HTTPException(status_code=404, detail="课程不存在")
    return success(StudentCourseModel().get_students_by_course(course_id))


@router.post("/select/{student_id}")  # 路由装饰器：注册 POST 新增接口
def select_course(student_id: int, data: CourseSelect):
    """选课：学生选一门课程（不能重复选）"""
    if StudentModel().get_by_id(student_id) is None:
        raise HTTPException(status_code=404, detail="学生不存在")
    if CourseModel().get_by_id(data.course_id) is None:
        raise HTTPException(status_code=404, detail="课程不存在")
    if StudentCourseModel().is_selected(student_id, data.course_id):
        raise HTTPException(status_code=400, detail="该课程已选过，不能重复选")
    StudentCourseModel().select(student_id, data.course_id)
    logger.info("学生选课 学生id:%s → 课程%s", student_id, data.course_id)
    return success(msg="选课成功")


@router.delete("/unselect/{student_id}")  # 路由装饰器：注册 DELETE 删除接口
def unselect_course(student_id: int, course_id: int):
    """退课：学生退掉一门课程（不能退到 0 门）"""
    if not StudentCourseModel().is_selected(student_id, course_id):
        raise HTTPException(status_code=400, detail="未选该课程，无法退课")
    if StudentCourseModel().count_by_student(student_id) <= 1:
        raise HTTPException(status_code=400, detail="每个学生至少选择一门课程，不能退掉最后一门课程")
    StudentCourseModel().unselect(student_id, course_id)
    logger.info("学生退课 学生id:%s 课程%s", student_id, course_id)
    return success(msg="退课成功")


@router.put("/score/{student_id}")  # 路由装饰器：注册 PUT 修改接口
def set_score(student_id: int, data: ScoreUpdate):
    """成绩：为某学生的某门课登记成绩"""
    if not StudentCourseModel().is_selected(student_id, data.course_id):
        raise HTTPException(status_code=400, detail="该学生未选此课程")
    StudentCourseModel().set_score(student_id, data.course_id, data.score)
    logger.info("成绩登记 学生id:%s 课程%s 成绩%s", student_id, data.course_id, data.score)
    return success(msg="成绩登记成功")
