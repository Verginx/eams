# 文件名：student/router.py
"""
学生模块：学生增删改查、分班、选老师、回收站管理

职责：
- 定义 /students 前缀下全部端点（含回收站管理）
- 路由层做存在性校验（学生/班级/教师不存在抛 404），数据访问委托 StudentModel
- 列表支持关键字查询与分页（/students/page 返回 {total, items}）
- 删除为逻辑删除（移入回收站），回收站支持恢复与真实删除
- 回收站操作需管理员权限（校验请求头 X-Current-Role）
"""
import logging

from fastapi import APIRouter, Depends, Header, HTTPException

from com.wanhe.student.model import StudentModel
from com.wanhe.student.vo import StudentCreate, StudentUpdate, ClassAssign, TeacherAssign
from com.wanhe.classes.model import ClassModel
from com.wanhe.teacher.model import TeacherModel
from com.wanhe.common.response import success

logger = logging.getLogger(__name__)

# 创建子路由：统一接口前缀、文档标签
router = APIRouter(prefix="/students", tags=["学生模块"])


# ===== 管理员权限校验依赖 =====

def verify_admin(x_current_role: str = Header(None, alias="X-Current-Role")):
    """
    管理员权限校验：从请求头 X-Current-Role 读取当前用户角色
    仅 admin 角色可继续，否则抛出 403
    :param x_current_role: 请求头中的角色字段
    :return: True（校验通过）
    :raises HTTPException 403: 非管理员
    """
    if x_current_role != 'admin':
        logger.warning("回收站操作被拒 角色:%s", x_current_role)
        raise HTTPException(status_code=403, detail="仅管理员可操作回收站")
    return True


def get_current_user(x_current_user: str = Header(None, alias="X-Current-User")):
    """
    从请求头读取当前操作用户名
    :param x_current_user: 请求头中的用户名字段
    :return: 用户名字符串，未传则返回 "unknown"
    """
    return x_current_user or "unknown"


# ===== 查询接口（均自动过滤 is_deleted=0） =====

@router.get("/all")  # 路由装饰器：注册 GET 查询接口
def list_students(keyword: str = ""):
    """查：获取所有学生（含班级名、教师名、选课数），可按姓名模糊查询，不显示回收站数据"""
    return success(StudentModel().get_all(keyword))


@router.get("/page")  # 路由装饰器：注册 GET 查询接口
def list_students_page(keyword: str = "", page: int = 1, page_size: int = 10):
    """查：学生分页列表，返回 {"total", "items"}，支持关键字查询，不显示回收站数据"""
    return success(StudentModel().get_page(keyword, page, page_size))


@router.get("/one/{student_id}")  # 路由装饰器：注册 GET 查询接口
def get_student(student_id: int):
    """查：按 ID 获取单个学生，不查询回收站数据"""
    student = StudentModel().get_by_id(student_id, show_deleted=False)
    if student is None:
        raise HTTPException(status_code=404, detail="学生不存在")
    return success(student)


# ===== 新增接口 =====

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


# ===== 修改接口（仅允许操作未删除的学生） =====

@router.put("/update/{student_id}")  # 路由装饰器：注册 PUT 修改接口
def update_student(student_id: int, data: StudentUpdate):
    """改：修改学生基本信息，仅限未删除的学生"""
    if StudentModel().get_by_id(student_id, show_deleted=False) is None:
        raise HTTPException(status_code=404, detail="学生不存在")
    StudentModel().update(student_id, data.name, data.gender, data.age, data.grade)
    logger.info("修改学生 id:%s", student_id)
    return success(msg="修改成功")


@router.put("/assign-class/{student_id}")  # 路由装饰器：注册 PUT 修改接口
def assign_class(student_id: int, data: ClassAssign):
    """分班：把学生安排到指定班级，仅限未删除的学生"""
    if StudentModel().get_by_id(student_id, show_deleted=False) is None:
        raise HTTPException(status_code=404, detail="学生不存在")
    if ClassModel().get_by_id(data.class_id) is None:
        raise HTTPException(status_code=404, detail="班级不存在")
    StudentModel().change_class(student_id, data.class_id)
    logger.info("学生分班 id:%s → 班级%s", student_id, data.class_id)
    return success(msg="分班成功")


@router.put("/assign-teacher/{student_id}")  # 路由装饰器：注册 PUT 修改接口
def assign_teacher(student_id: int, data: TeacherAssign):
    """选老师：把学生分配给指定教师（teacher_id 为 null 时清空），仅限未删除的学生"""
    if StudentModel().get_by_id(student_id, show_deleted=False) is None:
        raise HTTPException(status_code=404, detail="学生不存在")
    # teacher_id 为空表示清空所选老师；非空才校验教师存在性
    if data.teacher_id is not None and TeacherModel().get_by_id(data.teacher_id) is None:
        raise HTTPException(status_code=404, detail="教师不存在")
    StudentModel().change_teacher(student_id, data.teacher_id)
    logger.info("学生选老师 id:%s → 教师%s", student_id, data.teacher_id)
    return success(msg="选老师成功")


# ===== 删除接口（逻辑删除 → 移入回收站） =====

@router.delete("/del/{student_id}")  # 路由装饰器：注册 DELETE 删除接口
def delete_student(student_id: int, operator: str = Depends(get_current_user)):
    """
    删：逻辑删除学生（移入回收站）
    记录操作人、删除时间，不真实删除数据
    回收站中的数据可通过 /recycle/recover 恢复
    :param student_id: 学生 ID
    :param operator: 当前操作用户（从请求头 X-Current-User 读取）
    """
    # 先确认学生存在且未被删除
    student = StudentModel().get_by_id(student_id, show_deleted=False)
    if student is None:
        raise HTTPException(status_code=404, detail="学生不存在或已在回收站中")

    affected = StudentModel().logic_delete(student_id, operator)
    if affected == 0:
        raise HTTPException(status_code=400, detail="删除失败，学生可能已在回收站中")

    logger.info("逻辑删除学生 id:%s 操作人:%s", student_id, operator)
    return success(msg="已移入回收站")


# ===== 回收站接口（需管理员权限） =====

@router.get("/recycle/list")  # 路由装饰器：注册 GET 查询接口
def get_recycle_list(
    keyword: str = "",
    page: int = 1,
    page_size: int = 10,
    _admin: bool = Depends(verify_admin),
):
    """
    回收站列表（管理员专属）：查询所有被逻辑删除的学生
    按删除时间倒序排列，支持姓名关键字搜索与分页
    :param keyword: 姓名关键字（可选）
    :param page: 页码
    :param page_size: 每页条数
    :param _admin: 管理员权限校验（Depends 注入，非 admin 返回 403）
    """
    logger.info("管理员查询回收站列表 keyword:%s page:%s", keyword, page)
    return success(StudentModel().get_recycle_list(keyword, page, page_size))


@router.put("/recycle/recover/{student_id}")  # 路由装饰器：注册 PUT 修改接口
def recover_student(
    student_id: int,
    _admin: bool = Depends(verify_admin),
):
    """
    恢复学生（管理员专属）：从回收站还原学生到正常列表
    清除 is_deleted 标记、删除时间、操作人
    :param student_id: 学生 ID
    :param _admin: 管理员权限校验（Depends 注入，非 admin 返回 403）
    """
    # 查询回收站中的学生（show_deleted=True 才能查到）
    student = StudentModel().get_by_id(student_id, show_deleted=True)
    if student is None:
        raise HTTPException(status_code=404, detail="学生不存在")
    if student.get('is_deleted') != 1:
        raise HTTPException(status_code=400, detail="该学生不在回收站中，无需恢复")

    affected = StudentModel().recover_student(student_id)
    if affected == 0:
        raise HTTPException(status_code=400, detail="恢复失败，学生可能不在回收站中")

    logger.info("恢复学生 id:%s 姓名:%s", student_id, student.get('name'))
    return success({"student_id": student_id}, msg="已从回收站恢复")


@router.delete("/recycle/real-del/{student_id}")  # 路由装饰器：注册 DELETE 删除接口
def real_delete_student(
    student_id: int,
    _admin: bool = Depends(verify_admin),
):
    """
    真实删除（管理员专属）：物理删除学生及其选课记录、关联账号，不可恢复
    仅允许删除回收站中的数据（is_deleted=1），防止误删正常数据
    :param student_id: 学生 ID
    :param _admin: 管理员权限校验（Depends 注入，非 admin 返回 403）
    """
    # 查询回收站中的学生（show_deleted=True 才能查到）
    student = StudentModel().get_by_id(student_id, show_deleted=True)
    if student is None:
        raise HTTPException(status_code=404, detail="学生不存在")
    if student.get('is_deleted') != 1:
        raise HTTPException(status_code=400, detail="该学生不在回收站中，请先移入回收站后再执行真实删除")

    affected = StudentModel().real_delete(student_id)
    if affected == 0:
        raise HTTPException(status_code=400, detail="真实删除失败，请确认学生已在回收站中")

    logger.info("真实删除学生 id:%s 姓名:%s（不可恢复）", student_id, student.get('name'))
    return success({"student_id": student_id}, msg="已永久删除，不可恢复")
