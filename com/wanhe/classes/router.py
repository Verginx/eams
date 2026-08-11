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


@router.post("/add")  # 路由装饰器：注册 POST 新增接口
def add_class(data: ClassCreate):
    """增：新增班级（若指定班主任，先验证教师存在）"""
    if data.head_teacher_id and TeacherModel().get_by_id(data.head_teacher_id) is None:
        raise HTTPException(status_code=404, detail="班主任教师不存在")
    new_id = ClassModel().create(data.name, data.grade, data.head_teacher_id)
    logger.info("新增班级 id:%s 名称:%s", new_id, data.name)
    return success({"id": new_id}, msg="新增成功")


@router.put("/update/{class_id}")  # 路由装饰器：注册 PUT 修改接口
def update_class(class_id: int, data: ClassUpdate):
    """改：修改班级信息（改年级时清理年级不匹配学生的分班）"""
    cls = ClassModel().get_by_id(class_id)
    if cls is None:
        raise HTTPException(status_code=404, detail="班级不存在")
    if data.head_teacher_id and TeacherModel().get_by_id(data.head_teacher_id) is None:
        raise HTTPException(status_code=404, detail="班主任教师不存在")
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
    """删：删除班级"""
    if ClassModel().get_by_id(class_id) is None:
        raise HTTPException(status_code=404, detail="班级不存在")
    ClassModel().delete(class_id)
    logger.info("删除班级 id:%s", class_id)
    return success(msg="删除成功")
