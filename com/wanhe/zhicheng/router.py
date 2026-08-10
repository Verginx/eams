# 文件名：zhicheng/router.py
"""
职称模块：职称增删改查

职责：定义 /zhicheng 前缀下端点，存在性校验后委托 ZhichengModel
"""
import logging

from fastapi import APIRouter, HTTPException

from com.wanhe.zhicheng.model import ZhichengModel
from com.wanhe.zhicheng.vo import ZhichengCreate, ZhichengUpdate
from com.wanhe.common.response import success

logger = logging.getLogger(__name__)

# 创建子路由
router = APIRouter(prefix="/zhicheng", tags=["职称模块"])


@router.get("/all")  # 路由装饰器：注册 GET 查询接口
def list_zhicheng(keyword: str = ""):
    """查：获取所有职称，可按职称名模糊查询"""
    return success(ZhichengModel().get_all(keyword))


@router.get("/one/{zhicheng_id}")  # 路由装饰器：注册 GET 查询接口
def get_zhicheng(zhicheng_id: int):
    """查：按 ID 获取单个职称"""
    item = ZhichengModel().get_by_id(zhicheng_id)
    if item is None:
        raise HTTPException(status_code=404, detail="职称不存在")
    return success(item)


@router.post("/add")  # 路由装饰器：注册 POST 新增接口
def add_zhicheng(data: ZhichengCreate):
    """增：新增职称"""
    new_id = ZhichengModel().create(data.name, data.level, data.description)
    logger.info("新增职称 id:%s 名称:%s", new_id, data.name)
    return success({"id": new_id}, msg="新增成功")


@router.put("/update/{zhicheng_id}")  # 路由装饰器：注册 PUT 修改接口
def update_zhicheng(zhicheng_id: int, data: ZhichengUpdate):
    """改：修改职称信息"""
    if ZhichengModel().get_by_id(zhicheng_id) is None:
        raise HTTPException(status_code=404, detail="职称不存在")
    ZhichengModel().update(zhicheng_id, data.name, data.level, data.description)
    logger.info("修改职称 id:%s", zhicheng_id)
    return success(msg="修改成功")


@router.delete("/del/{zhicheng_id}")  # 路由装饰器：注册 DELETE 删除接口
def delete_zhicheng(zhicheng_id: int):
    """删：删除职称"""
    if ZhichengModel().get_by_id(zhicheng_id) is None:
        raise HTTPException(status_code=404, detail="职称不存在")
    ZhichengModel().delete(zhicheng_id)
    logger.info("删除职称 id:%s", zhicheng_id)
    return success(msg="删除成功")
