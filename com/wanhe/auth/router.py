# 文件名：auth/router.py
"""
认证模块：学生注册、登录、忘记密码重置（公开接口，无鉴权）
"""
import logging

from fastapi import APIRouter, HTTPException

from com.wanhe.auth.model import UserModel
from com.wanhe.auth.vo import (
    RegisterRequest,
    LoginRequest,
    ResetPasswordRequest,
    validate_password_strength,
    get_password_strength_level,
)
from com.wanhe.student.model import StudentModel
from com.wanhe.common.response import success

logger = logging.getLogger(__name__)

# 创建子路由：统一接口前缀、文档标签
router = APIRouter(prefix="/auth", tags=["认证模块"])


@router.post("/register")  # 路由装饰器：注册 POST 新增接口
def register(data: RegisterRequest):
    """
    学生自主注册（含密码强度校验）
    流程：校验密码强度 → 创建学生记录 → 再用学生ID创建登录账号
    :param data: 注册请求体（用户名/密码/姓名/性别/年龄）
    :return: {"student_id", "username"}
    :raises HTTPException 400: 用户名已存在
    """
    # 1. 检查用户名是否已被占用
    if UserModel().find_by_username(data.username):
        logger.warning("注册失败 用户名已存在:%s", data.username)
        raise HTTPException(status_code=400, detail="用户名已存在")

    # 2. 密码强度校验（pydantic validator 已做基础校验，此处做二次确认）
    ok, err_msg = validate_password_strength(data.password)
    if not ok:
        raise HTTPException(status_code=400, detail=err_msg)

    # 3. 创建学生记录（初始未分班、未选老师）
    student_id = StudentModel().create(
        name=data.name,
        gender=data.gender,
        age=data.age,
        grade='高一',
        class_id=None,
        teacher_id=None,
        enrollment_date='2025-09-01',
    )

    # 4. 创建登录账号，关联学生ID
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


@router.post("/check-username")  # 路由装饰器：注册 POST 新增接口
def check_username(body: dict):
    """
    忘记密码前置校验：确认用户名是否存在
    请求体: {"username": "..."}
    :return: {"exists": true, "username": "..."}
    """
    username = body.get("username", "").strip() if body else ""

    if not username:
        raise HTTPException(status_code=400, detail="请输入用户名")

    user = UserModel().find_by_username(username)

    if user is None:
        logger.warning("重置密码 用户名不存在:%s", username)
        raise HTTPException(status_code=400, detail="用户名不存在")

    logger.info("重置密码 用户名验证通过:%s", username)
    return success({"exists": True, "username": username}, msg="用户名验证通过")


@router.post("/reset-password")  # 路由装饰器：注册 POST 新增接口
def reset_password(data: ResetPasswordRequest):
    """
    忘记密码 - 重置密码（含密码强度校验）
    流程：验证用户名存在 → 校验新密码强度 → 更新密码
    :param data: ResetPasswordRequest（username / new_password）
    :return: {"username"}
    :raises HTTPException 400: 用户名不存在
    """
    # 1. 验证用户名是否存在
    user = UserModel().find_by_username(data.username)
    if user is None:
        logger.warning("重置密码失败 用户不存在:%s", data.username)
        raise HTTPException(status_code=400, detail="用户名不存在")

    # 2. 密码强度校验（pydantic validator 已做基础校验，此处做二次确认）
    ok, err_msg = validate_password_strength(data.new_password)
    if not ok:
        raise HTTPException(status_code=400, detail=err_msg)

    # 3. 更新密码
    UserModel().update_password(data.username, data.new_password)

    logger.info("重置密码成功 用户:%s", data.username)
    return success({"username": data.username}, msg="密码重置成功，请使用新密码登录")


@router.post("/password-strength")  # 路由装饰器：注册 POST 新增接口
def check_password_strength(body: dict):
    """
    前端实时检测密码强度（可选接口，供前端强度条使用）
    请求体: {"password": "..."}
    :return: {"level": 0-5, "label": "...", "color": "...", "percent": 0-100, "valid": bool}
    """
    password = body.get("password", "") if body else ""
    strength = get_password_strength_level(password)
    ok, _ = validate_password_strength(password)
    strength["valid"] = ok
    return success(strength, msg="密码强度评估完成")
