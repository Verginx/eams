# 文件名：stats/router.py
"""
统计模块：首页统计分析接口（公开，无鉴权）

职责：
- GET /stats/class-count：各班级人数统计（柱状图数据源）
- GET /stats/gender-ratio：在校学生男女占比（饼状图数据源）
"""
import logging

from fastapi import APIRouter

from com.wanhe.stats.model import StatsModel
from com.wanhe.common.response import success

logger = logging.getLogger(__name__)

# 创建子路由
router = APIRouter(prefix="/stats", tags=["统计模块"])


@router.get("/class-count")  # 路由装饰器：注册 GET 查询接口
def class_count():
    """查：各班级人数统计（柱状图数据源）"""
    logger.info("查询各班级人数统计")
    return success(StatsModel().class_count())


@router.get("/gender-ratio")  # 路由装饰器：注册 GET 查询接口
def gender_ratio():
    """查：在校学生男女占比（饼状图数据源）"""
    logger.info("查询在校学生男女占比")
    return success(StatsModel().gender_ratio())
