# 文件名：auth/vo.py
"""
认证模块 - 请求 VO（注册/登录）

职责：定义注册、登录请求体的字段与校验规则（pydantic BaseModel）
依赖：pydantic（BaseModel / Field）
"""
from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    """学生注册请求体：字段校验规则与业务要求一致"""
    username: str = Field(..., min_length=3, max_length=20, description="用户名（3-20位）")
    password: str = Field(..., min_length=6, max_length=20, description="密码（6-20位）")
    name: str = Field(..., max_length=50, description="真实姓名")
    gender: str = Field('男', max_length=10, description="性别")
    age: int = Field(..., ge=10, le=100, description="年龄（10-100）")


class LoginRequest(BaseModel):
    """登录请求体"""
    username: str = Field(..., description="用户名")
    password: str = Field(..., description="密码")
