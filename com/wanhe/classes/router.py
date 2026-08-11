# 文件名：classes/router.py
"""
班级模块：班级增删改查（学生分班的数据基础）

职责：定义 /classes 前缀下端点，存在性校验（班级/班主任）后委托 ClassModel
"""
import logging

from fastapi import APIRouter, HTTPException

from com.wanhe.classes.model import ClassModel
from com.wanhe.classes.vo import ClassCreate, ClassUpdate
from com.wanhe.teacher.model import TeacherModel
from com.wanhe.common.response import success

logger = logging.getLogger(__name__)

# 创建子路由
router = APIRouter(prefix="/classes", tags=["班级模块"])


@router.get("/page")  # 路由装饰器：注册 GET 分页接口
def list_classes_page(keyword: str = "", grade: str = "", page: int = 1, page_size: int = 10):
    """查：班级分页列表，支持关键字 + 年级过滤"""
    return success(ClassModel().get_page(keyword, grade, page, page_size))


@router.get("/all")  # 路由装饰器：注册 GET 查询接口
def list_classes(keyword: str = ""):
    """查：获取所有班级（含班主任姓名），可按班级名模糊查询"""
    return success(ClassModel().get_all(keyword))


@router.get("/one/{class_id}")  # 路由装饰器：注册 GET 查询接口
def get_class(class_id: int):
    """查：按 ID 获取单个班级"""
    cls = ClassModel().get_by_id(class_id)
    if cls is None:
        raise HTTPException(status_code=404, detail="班级不存在")
    return success(cls)


@router.get("/{class_id}/detail")  # 路由装饰器：注册 GET 详情接口
def get_class_detail(class_id: int):
    """查：班级详情（含班主任、学生名单、男女统计）"""
    detail = ClassModel().get_detail(class_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="班级不存在")
    return success(detail)


@router.post("/add")  # 路由装饰器：注册 POST 新增接口
def add_class(data: ClassCreate):
    """增：新增班级（校验班主任存在 + 未被其他班级占用）"""
    if data.head_teacher_id and TeacherModel().get_by_id(data.head_teacher_id) is None:
        raise HTTPException(status_code=404, detail="班主任教师不存在")
    if data.head_teacher_id and ClassModel().is_head_teacher_taken(data.head_teacher_id):
        raise HTTPException(status_code=409, detail=f"教师ID {data.head_teacher_id} 已是其他班班主任")
    new_id = ClassModel().create(data.name, data.grade, data.head_teacher_id)
    logger.info("新增班级 id:%s 名称:%s", new_id, data.name)
    return success({"id": new_id}, msg="新增成功")


@router.put("/update/{class_id}")  # 路由装饰器：注册 PUT 修改接口
def update_class(class_id: int, data: ClassUpdate):
    """改：修改班级信息（含班主任唯一性校验，排除自身；年级变更后清理不匹配学生）"""
    cls = ClassModel().get_by_id(class_id)
    if cls is None:
        raise HTTPException(status_code=404, detail="班级不存在")
    if data.head_teacher_id and TeacherModel().get_by_id(data.head_teacher_id) is None:
        raise HTTPException(status_code=404, detail="班主任教师不存在")
    if data.head_teacher_id and ClassModel().is_head_teacher_taken(
        data.head_teacher_id, exclude_class_id=class_id
    ):
        raise HTTPException(status_code=409, detail=f"教师ID {data.head_teacher_id} 已是其他班班主任")

    grade_changed = cls["grade"] != data.grade
    ClassModel().update(class_id, data.name, data.grade, data.head_teacher_id)
    if grade_changed:
        ClassModel().unbind_mismatched_students(class_id, data.grade)
        logger.info("修改班级 id:%s 年级变更 %s→%s，已清空年级不匹配学生的分班",
                    class_id, cls["grade"], data.grade)
    else:
        logger.info("修改班级 id:%s", class_id)
    return success(msg="修改成功")


@router.delete("/del/{class_id}")  # 路由装饰器：注册 DELETE 删除接口
def delete_class(class_id: int):
    """删：删除空班级（有学生时拒绝并提示）"""
    if ClassModel().get_by_id(class_id) is None:
        raise HTTPException(status_code=404, detail="班级不存在")
    student_count = ClassModel().count_students(class_id)
    if student_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"班级下有 {student_count} 名学生，请先转移后再删除"
        )
    ClassModel().delete(class_id)
    logger.info("删除班级 id:%s", class_id)
    return success(msg="删除成功")
