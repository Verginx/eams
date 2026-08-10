# 文件名：zhicheng/vo.py
"""
职称模块 - 请求 VO（新增/修改）

职责：定义职称新增、修改请求体的字段与校验规则
依赖：pydantic（BaseModel / Field）
"""
from pydantic import BaseModel, Field


class ZhichengCreate(BaseModel):
    """新增职称请求体"""
    name: str = Field(..., max_length=50, description="职称名称")
    level: int = Field(1, ge=1, le=10, description="级别（数值越大等级越高）")
    description: str = Field('', max_length=200, description="职称说明")


class ZhichengUpdate(BaseModel):
    """修改职称请求体（字段与新增一致）"""
    name: str = Field(..., max_length=50, description="职称名称")
    level: int = Field(1, ge=1, le=10, description="级别（数值越大等级越高）")
    description: str = Field('', max_length=200, description="职称说明")
