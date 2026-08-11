# 文件名：classes/vo.py
"""
班级模块 - 请求 VO

职责：定义班级新增/修改请求体的字段与校验规则
依赖：pydantic（BaseModel / Field）
"""
from typing import Optional

from pydantic import BaseModel, Field


class ClassCreate(BaseModel):
    """新增班级请求体"""
    name: str = Field(..., max_length=50, description="班级名称，如：高一(1)班")
    grade: str = Field('高一', max_length=20, description="年级")
    head_teacher_id: Optional[int] = Field(None, description="班主任教师ID")


class ClassUpdate(BaseModel):
    """修改班级请求体（字段与新增一致）"""
    name: str = Field(..., max_length=50, description="班级名称")
    grade: str = Field('高一', max_length=20, description="年级")
    head_teacher_id: Optional[int] = Field(None, description="班主任教师ID")
