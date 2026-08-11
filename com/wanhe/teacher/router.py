# 文件名：teacher/router.py
"""
教师模块：教师增删改查

职责：定义 /teachers 前缀下端点，存在性校验后委托 TeacherModel
"""
import logging

from fastapi import APIRouter, HTTPException

from com.wanhe.teacher.model import TeacherModel
from com.wanhe.teacher.vo import TeacherCreate, TeacherUpdate
from com.wanhe.common.response import success

logger = logging.getLogger(__name__)

# 创建子路由
router = APIRouter(prefix="/teachers", tags=["教师模块"])


@router.get("/all")  # 路由装饰器：注册 GET 查询接口
def list_teachers(keyword: str = ""):
    """查：获取所有教师，可按姓名模糊查询"""
    return success(TeacherModel().get_all(keyword))


@router.get("/one/{teacher_id}")  # 路由装饰器：注册 GET 查询接口
def get_teacher(teacher_id: int):
    """查：按 ID 获取单个教师"""
    teacher = TeacherModel().get_by_id(teacher_id)
    if teacher is None:
        raise HTTPException(status_code=404, detail="教师不存在")
    return success(teacher)


@router.get("/{teacher_id}/detail")  # 路由装饰器：注册 GET 查询接口
def get_teacher_detail(teacher_id: int):
    """查：教师详情（基本信息 + 授课课程 + 班主任班级 + 选其课程的学生）"""
    detail = TeacherModel().get_detail(teacher_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="教师不存在")
    return success(detail)


@router.post("/add")  # 路由装饰器：注册 POST 新增接口
def add_teacher(data: TeacherCreate):
    """增：新增教师"""
    new_id = TeacherModel().create(
        name=data.name,
        gender=data.gender,
        age=data.age,
        subject=data.subject,
        phone=data.phone,
        zhicheng_id=data.zhicheng_id,
        base_salary=data.base_salary,
        class_fee=data.class_fee,
        bonus=data.bonus,
        education=data.education,
        hire_date=data.hire_date,
        remark=data.remark,
    )
    logger.info("新增教师 id:%s 姓名:%s", new_id, data.name)
    return success({"id": new_id}, msg="新增成功")


@router.put("/update/{teacher_id}")  # 路由装饰器：注册 PUT 修改接口
def update_teacher(teacher_id: int, data: TeacherUpdate):
    """改：修改教师信息"""
    if TeacherModel().get_by_id(teacher_id) is None:
        raise HTTPException(status_code=404, detail="教师不存在")
    TeacherModel().update(
        teacher_id, data.name, data.gender, data.age, data.subject, data.phone, data.zhicheng_id,
        data.base_salary, data.class_fee, data.bonus, data.education, data.hire_date, data.remark
    )
    logger.info("修改教师 id:%s", teacher_id)
    return success(msg="修改成功")


@router.delete("/del/{teacher_id}")  # 路由装饰器：注册 DELETE 删除接口
def delete_teacher(teacher_id: int):
    """删：删除教师"""
    if TeacherModel().get_by_id(teacher_id) is None:
        raise HTTPException(status_code=404, detail="教师不存在")
    TeacherModel().delete(teacher_id)
    logger.info("删除教师 id:%s", teacher_id)
    return success(msg="删除成功")
