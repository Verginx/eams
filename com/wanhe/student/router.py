# 文件名：student/router.py
"""
学生模块：学生增删改查、分班、选老师

职责：
- 定义 /students 前缀下全部端点
- 路由层做存在性校验（学生/班级/教师不存在抛 404），数据访问委托 StudentModel
- 列表支持关键字查询与分页（/students/page 返回 {total, items}）
"""
import logging

from fastapi import APIRouter, HTTPException

from com.wanhe.student.model import StudentModel
from com.wanhe.student.vo import StudentCreate, StudentUpdate, ClassAssign, TeacherAssign
from com.wanhe.classes.model import ClassModel
from com.wanhe.teacher.model import TeacherModel
from com.wanhe.common.response import success

logger = logging.getLogger(__name__)

# 创建子路由：统一接口前缀、文档标签
router = APIRouter(prefix="/students", tags=["学生模块"])


@router.get("/all")  # 路由装饰器：注册 GET 查询接口
def list_students(keyword: str = ""):
    """查：获取所有学生（含班级名、教师名、选课数），可按姓名模糊查询"""
    return success(StudentModel().get_all(keyword))


@router.get("/page")  # 路由装饰器：注册 GET 查询接口
def list_students_page(keyword: str = "", page: int = 1, page_size: int = 10):
    """查：学生分页列表，返回 {"total", "items"}，支持关键字查询"""
    return success(StudentModel().get_page(keyword, page, page_size))


@router.get("/one/{student_id}")  # 路由装饰器：注册 GET 查询接口
def get_student(student_id: int):
    """查：按 ID 获取单个学生"""
    student = StudentModel().get_by_id(student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="学生不存在")
    return success(student)


@router.post("/add")  # 路由装饰器：注册 POST 新增接口
def add_student(data: StudentCreate):
    """增：新增学生（若指定班级/教师，先验证存在）"""
    # 若指定了班级/教师，先验证存在
    if data.class_id and ClassModel().get_by_id(data.class_id) is None:
        raise HTTPException(status_code=404, detail="班级不存在")
    if data.teacher_id and TeacherModel().get_by_id(data.teacher_id) is None:
        raise HTTPException(status_code=404, detail="教师不存在")

    new_id = StudentModel().create(
        name=data.name,
        gender=data.gender,
        age=data.age,
        grade=data.grade,
        class_id=data.class_id,
        teacher_id=data.teacher_id,
        enrollment_date=data.enrollment_date,
    )
    logger.info("新增学生 id:%s 姓名:%s", new_id, data.name)
    return success({"id": new_id}, msg="新增成功")


@router.put("/update/{student_id}")  # 路由装饰器：注册 PUT 修改接口
def update_student(student_id: int, data: StudentUpdate):
    """改：修改学生基本信息"""
    if StudentModel().get_by_id(student_id) is None:
        raise HTTPException(status_code=404, detail="学生不存在")
    StudentModel().update(student_id, data.name, data.gender, data.age, data.grade)
    logger.info("修改学生 id:%s", student_id)
    return success(msg="修改成功")


@router.put("/assign-class/{student_id}")  # 路由装饰器：注册 PUT 修改接口
def assign_class(student_id: int, data: ClassAssign):
    """分班：把学生安排到指定班级"""
    if StudentModel().get_by_id(student_id) is None:
        raise HTTPException(status_code=404, detail="学生不存在")
    if ClassModel().get_by_id(data.class_id) is None:
        raise HTTPException(status_code=404, detail="班级不存在")
    StudentModel().change_class(student_id, data.class_id)
    logger.info("学生分班 id:%s → 班级%s", student_id, data.class_id)
    return success(msg="分班成功")


@router.put("/assign-teacher/{student_id}")  # 路由装饰器：注册 PUT 修改接口
def assign_teacher(student_id: int, data: TeacherAssign):
    """选老师：把学生分配给指定教师"""
    if StudentModel().get_by_id(student_id) is None:
        raise HTTPException(status_code=404, detail="学生不存在")
    if TeacherModel().get_by_id(data.teacher_id) is None:
        raise HTTPException(status_code=404, detail="教师不存在")
    StudentModel().change_teacher(student_id, data.teacher_id)
    logger.info("学生选老师 id:%s → 教师%s", student_id, data.teacher_id)
    return success(msg="选老师成功")


@router.delete("/del/{student_id}")  # 路由装饰器：注册 DELETE 删除接口
def delete_student(student_id: int):
    """删：删除学生（连带清理选课记录和账号）"""
    if StudentModel().get_by_id(student_id) is None:
        raise HTTPException(status_code=404, detail="学生不存在")
    StudentModel().delete(student_id)
    logger.info("删除学生 id:%s", student_id)
    return success(msg="删除成功")
