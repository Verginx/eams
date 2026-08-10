# 文件名：course/vo.py
"""
课程模块 - 请求 VO（课程/选课/成绩）

职责：定义课程、选课、成绩相关请求体的字段与校验规则
依赖：pydantic（BaseModel / Field）
"""
from pydantic import BaseModel, Field


class CourseCreate(BaseModel):
    """新增课程请求体"""
    name: str = Field(..., max_length=50, description="课程名称")
    credit: int = Field(1, ge=1, le=10, description="学分（1-10）")
    teacher_id: int = Field(None, description="授课教师ID")


class CourseUpdate(BaseModel):
    """修改课程请求体（字段与新增一致）"""
    name: str = Field(..., max_length=50, description="课程名称")
    credit: int = Field(1, ge=1, le=10, description="学分")
    teacher_id: int = Field(None, description="授课教师ID")


class CourseSelect(BaseModel):
    """选课请求体"""
    course_id: int = Field(..., description="要选的课程ID")


class ScoreUpdate(BaseModel):
    """登记成绩请求体"""
    course_id: int = Field(..., description="课程ID")
    score: float = Field(..., ge=0, le=100, description="成绩（0-100）")
