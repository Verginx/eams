# 文件名：common/exceptions.py
"""
公共模块 - 全局异常处理

职责：
- 统一捕获异常，全部接口错误响应统一为 {"code", "msg", "data"} envelope
- 处理三类异常：业务 HTTPException、参数校验 RequestValidationError、兜底 Exception

设计说明：
- HTTPException（业务抛出的 400/401/404 等）：code=HTTP 状态码，msg=detail
- RequestValidationError（pydantic 422）：返回校验明细到 data，便于定位问题字段
- Exception（兜底 500）：不向客户端泄露堆栈，仅返回通用错误信息
- 注意：FastAPI 按异常类型精确查表，RequestValidationError 需单独注册（不能只注册 HTTPException）
"""
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


def register_exception_handlers(app: FastAPI):
    """把全局异常处理器注册到 FastAPI 实例"""

    @app.exception_handler(HTTPException)  # 异常处理器装饰器：注册业务 HTTPException 处理器 → 统一转 {code,msg,data} envelope
    async def http_exception_handler(request: Request, exc: HTTPException):
        """
        业务/框架 HTTPException（400/401/404/405 等）统一转 envelope
        :param exc: 包含 status_code 与 detail
        :return: JSONResponse，body 为 {"code": 状态码, "msg": detail, "data": null}
        """
        return JSONResponse(
            status_code=exc.status_code,
            content={"code": exc.status_code, "msg": exc.detail, "data": None},
        )

    @app.exception_handler(RequestValidationError)  # 异常处理器装饰器：注册参数校验异常处理器 → 422 返回校验明细
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """
        参数校验异常（pydantic 422）：返回校验明细
        :param exc: 含 errors()，列出每个失败字段及原因
        :return: 422 JSONResponse，data 为校验错误明细列表
        """
        return JSONResponse(
            status_code=422,
            content={"code": 422, "msg": "参数校验错误", "data": exc.errors()},
        )

    @app.exception_handler(Exception)  # 异常处理器装饰器：注册兜底异常处理器 → 500 统一格式
    async def global_exception_handler(request: Request, exc: Exception):
        """兜底捕获所有未处理异常（500），返回统一格式，不泄露堆栈"""
        return JSONResponse(
            status_code=500,
            content={"code": 500, "msg": f"服务器内部错误：{exc}", "data": None},
        )
