# 文件名：student/vo.py
"""
学生模块 - 请求 VO（新增/修改/分班/选老师）

职责：定义学生相关请求体的字段与校验规则
依赖：pydantic（BaseModel / Field）
"""
from pydantic import BaseModel, Field


class StudentCreate(BaseModel):
    """新增学生请求体"""
    name: str = Field(..., max_length=50, description="姓名")
    gender: str = Field('男', max_length=10, description="性别")
    age: int = Field(..., ge=10, le=100, description="年龄")
    grade: str = Field('高一', max_length=20, description="年级")
    class_id: int = Field(None, description="班级ID（可空，稍后分班）")
    teacher_id: int = Field(None, description="教师ID（可空，稍后选老师）")
    enrollment_date: str = Field('2025-09-01', description="入学日期 YYYY-MM-DD")


class StudentUpdate(BaseModel):
    """修改学生基本信息请求体（分班/选老师走专门接口）"""
    name: str = Field(..., max_length=50, description="姓名")
    gender: str = Field('男', max_length=10, description="性别")
    age: int = Field(..., ge=10, le=100, description="年龄")
    grade: str = Field('高一', max_length=20, description="年级")


class ClassAssign(BaseModel):
    """分班请求体：把学生安排到指定班级"""
    class_id: int = Field(..., description="目标班级ID")


class TeacherAssign(BaseModel):
    """选老师请求体：把学生分配给指定教师"""
    teacher_id: int = Field(..., description="目标教师ID")
