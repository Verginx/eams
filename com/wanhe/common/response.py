# 文件名：common/response.py
"""
公共模块 - 统一响应

职责：
- 提供统一的成功响应结构 {"code": 0, "msg": "...", "data": ...}
- 错误响应由 common/exceptions.py 的全局异常处理器统一生成，无需在此处理

设计说明：
- 全系统接口统一 envelope，前端按 code==0 判定成功
- 各业务 router 的成功返回一律通过 success() 包装，保证格式一致
"""


def success(data=None, msg="成功"):
    """
    构造统一成功响应
    :param data: 响应数据（可为 dict / list / None）
    :param msg: 提示信息（默认"成功"）
    :return: {"code": 0, "msg": msg, "data": data}
    """
    return {"code": 0, "msg": msg, "data": data}
