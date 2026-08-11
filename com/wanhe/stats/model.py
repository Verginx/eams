# 文件名：stats/model.py
"""
统计模块 - 数据访问层

职责：封装首页统计分析的 SQL（各班级人数、学生男女占比）
依赖：common.db.Database（with 语句自动释放连接）
"""
import logging

from com.wanhe.common.db import Database

logger = logging.getLogger(__name__)


class StatsModel:
    """统计数据分析"""

    def class_count(self):
        """
        统计各班级人数（含班级名与年级），供柱状图展示
        LEFT JOIN：无学生的班级也返回 cnt=0
        :return: [{class_name, grade, cnt}, ...] 按年级、班级ID排序
        """
        with Database() as db:
            rows = db.query_all(
                "SELECT c.id, c.name AS class_name, c.grade, COUNT(s.id) AS cnt "
                "FROM classes c LEFT JOIN students s ON s.class_id = c.id AND s.is_deleted = 0 "
                "GROUP BY c.id, c.name, c.grade "
                "ORDER BY c.grade, c.id"
            )
            logger.info("统计各班级人数，返回 %s 条", len(rows))
            return rows

    def gender_ratio(self):
        """
        统计在校学生男女占比，供饼状图展示
        :return: [{gender, cnt}, ...]（男/女各自人数）
        """
        with Database() as db:
            rows = db.query_all(
                "SELECT gender, COUNT(*) AS cnt FROM students WHERE is_deleted = 0 GROUP BY gender"
            )
            logger.info("统计在校学生男女占比，返回 %s 条", len(rows))
            return rows
