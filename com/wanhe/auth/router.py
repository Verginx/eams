# 文件名：auth/router.py
"""
认证模块：学生注册、登录（公开接口，无鉴权）
"""
import logging

from fastapi import APIRouter, HTTPException

from com.wanhe.auth.model import UserModel
from com.wanhe.auth.vo import RegisterRequest, LoginRequest
from com.wanhe.student.model import StudentModel
from com.wanhe.common.response import success

logger = logging.getLogger(__name__)

# 创建子路由：统一接口前缀、文档标签
router = APIRouter(prefix="/auth", tags=["认证模块"])


@router.post("/register")  # 路由装饰器：注册 POST 新增接口
def register(data: RegisterRequest):
    """
    学生自主注册
    流程：先创建学生记录 → 再用学生ID创建登录账号（密码明文存储，教学演示）
    :param data: 注册请求体（用户名/密码/姓名/性别/年龄）
    :return: {"student_id", "username"}
    :raises HTTPException 400: 用户名已存在
    """
    # 1. 检查用户名是否已被占用
    if UserModel().find_by_username(data.username):
        logger.warning("注册失败 用户名已存在:%s", data.username)
        raise HTTPException(status_code=400, detail="用户名已存在")

    # 2. 创建学生记录（初始未分班、未选课）
    student_id = StudentModel().create(
        name=data.name,
        gender=data.gender,
        age=data.age,
        grade='高一',
        class_id=None,
        enrollment_date='2025-09-01',
    )

    # 3. 创建登录账号，关联学生ID
    UserModel().create(
        username=data.username,
        password=data.password,
        role='student',
        student_id=student_id,
    )

    logger.info("注册成功 用户:%s", data.username)
    return success({"student_id": student_id, "username": data.username}, msg="注册成功")


@router.post("/login")  # 路由装饰器：注册 POST 新增接口
def login(data: LoginRequest):
    """
    登录：校验用户名和密码（明文比对，教学演示）
    :param data: 登录请求体（用户名/密码）
    :return: {"user_id", "username", "role", "student_id"}
    :raises HTTPException 400: 用户名或密码错误
    """
    user = UserModel().find_by_username(data.username)

    # 用户不存在或密码错误
    if user is None or user['password'] != data.password:
        logger.warning("登录失败 用户:%s", data.username)
        raise HTTPException(status_code=400, detail="用户名或密码错误")

    # 返回用户基本信息（无 token，教学演示）
    logger.info("登录成功 用户:%s 角色:%s", data.username, user['role'])
    return success({
        "user_id": user['id'],
        "username": user['username'],
        "role": user['role'],
        "student_id": user['student_id'],
    }, msg="登录成功")
