# 文件名：auth/vo.py
"""
认证模块 - 请求 VO（注册/登录/重置密码）

职责：定义注册、登录、重置密码请求体的字段与校验规则（pydantic BaseModel）
依赖：pydantic（BaseModel / Field）
"""
import re

from pydantic import BaseModel, Field, field_validator


# ===== 密码强度校验规则 =====
PASSWORD_RULES = {
    "min_length": 8,           # 最少 8 位
    "require_upper": True,     # 必须包含大写字母
    "require_lower": True,     # 必须包含小写字母
    "require_digit": True,     # 必须包含数字
    "require_special": True,   # 必须包含特殊字符
}


def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    校验密码强度
    :param password: 待校验的密码
    :return: (是否通过, 错误信息) — 通过时错误信息为空字符串
    """
    if len(password) < PASSWORD_RULES["min_length"]:
        return False, f"密码长度至少 {PASSWORD_RULES['min_length']} 位"
    if PASSWORD_RULES["require_upper"] and not re.search(r'[A-Z]', password):
        return False, "密码必须包含至少一个大写字母"
    if PASSWORD_RULES["require_lower"] and not re.search(r'[a-z]', password):
        return False, "密码必须包含至少一个小写字母"
    if PASSWORD_RULES["require_digit"] and not re.search(r'[0-9]', password):
        return False, "密码必须包含至少一个数字"
    if PASSWORD_RULES["require_special"] and not re.search(r'[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]', password):
        return False, "密码必须包含至少一个特殊字符（如 !@#$% 等）"
    return True, ""


def get_password_strength_level(password: str) -> dict:
    """
    评估密码强度等级（用于前端强度条展示）
    :param password: 密码
    :return: {"level": 0-4, "label": "弱/一般/中等/强/很强", "color": "#...", "percent": 0-100}
    """
    score = 0
    if len(password) >= 8:
        score += 1
    if re.search(r'[A-Z]', password):
        score += 1
    if re.search(r'[a-z]', password):
        score += 1
    if re.search(r'[0-9]', password):
        score += 1
    if re.search(r'[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]', password):
        score += 1

    levels = {
        0: {"level": 0, "label": "弱",   "color": "#ff4d4f", "percent": 0},
        1: {"level": 1, "label": "弱",   "color": "#ff4d4f", "percent": 20},
        2: {"level": 2, "label": "一般", "color": "#fa8c16", "percent": 40},
        3: {"level": 3, "label": "中等", "color": "#1890ff", "percent": 60},
        4: {"level": 4, "label": "强",   "color": "#52c41a", "percent": 80},
        5: {"level": 5, "label": "很强", "color": "#52c41a", "percent": 100},
    }
    return levels.get(score, levels[0])


class RegisterRequest(BaseModel):
    """学生注册请求体：字段校验规则与业务要求一致"""
    username: str = Field(..., min_length=3, max_length=20, description="用户名（3-20位）")
    password: str = Field(..., min_length=8, max_length=30, description="密码（8-30位，需含大小写字母+数字+特殊字符）")
    name: str = Field(..., max_length=50, description="真实姓名")
    gender: str = Field('男', max_length=10, description="性别")
    age: int = Field(..., ge=10, le=100, description="年龄（10-100）")

    @field_validator('password')
    @classmethod
    def check_password_strength(cls, v):
        """校验密码强度（注册时必须满足强度要求）"""
        ok, err_msg = validate_password_strength(v)
        if not ok:
            raise ValueError(err_msg)
        return v


class LoginRequest(BaseModel):
    """登录请求体"""
    username: str = Field(..., description="用户名")
    password: str = Field(..., description="密码")


class ResetPasswordRequest(BaseModel):
    """忘记密码 - 重置密码请求体"""
    username: str = Field(..., min_length=3, max_length=20, description="用户名")
    new_password: str = Field(..., min_length=8, max_length=30, description="新密码（8-30位，需含大小写字母+数字+特殊字符）")

    @field_validator('new_password')
    @classmethod
    def check_password_strength(cls, v):
        """校验新密码强度"""
        ok, err_msg = validate_password_strength(v)
        if not ok:
            raise ValueError(err_msg)
        return v
