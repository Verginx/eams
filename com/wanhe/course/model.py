# 文件名：course/model.py
"""
课程模块 - 数据访问层（含选课、成绩）

职责：
- CourseModel：封装 courses 表 SQL（增删改查 + 按课程名查询，关联授课教师）
- StudentCourseModel：封装 student_course 表 SQL（学生选课/退课/成绩/查询）
依赖：common.db.Database
"""
from com.wanhe.common.db import Database


class CourseModel:
    """课程表数据访问"""

    def get_all(self, keyword=''):
        """
        查询所有课程（关联授课教师名），可按课程名模糊查询
        :param keyword: 课程名关键字（可选）
        :return: 课程行字典列表（含 teacher_name、已选人数）
        """
        sql = (
            "SELECT c.*, t.name AS teacher_name, "
            "       (SELECT COUNT(*) FROM student_course sc "
            "        WHERE sc.course_id = c.id) AS enrolled_count "
            "FROM courses c LEFT JOIN teachers t ON c.teacher_id = t.id "
        )
        params = []
        if keyword:
            sql += "WHERE c.name LIKE %s "
            params.append(f"%{keyword}%")
        sql += "ORDER BY c.id"
        with Database() as db:
            return db.query_all(sql, tuple(params))

    def get_by_id(self, course_id):
        """
        按 ID 查询课程
        :param course_id: 课程 ID
        :return: 课程行 dict；不存在返回 None
        """
        with Database() as db:
            return db.query_one("SELECT * FROM courses WHERE id = %s", (course_id,))

    def create(self, name, credit, teacher_id, status, mode, max_students):
        """
        新增课程
        :return: 新课程自增 ID
        """
        with Database() as db:
            return db.insert(
                "INSERT INTO courses (name, credit, teacher_id, status, mode, max_students) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (name, credit, teacher_id, status, mode, max_students)
            )

    def update(self, course_id, name, credit, teacher_id, status, mode, max_students):
        """
        修改课程
        :return: 受影响行数
        """
        with Database() as db:
            return db.execute(
                "UPDATE courses SET name=%s, credit=%s, teacher_id=%s, "
                "status=%s, mode=%s, max_students=%s "
                "WHERE id=%s",
                (name, credit, teacher_id, status, mode, max_students, course_id)
            )

    def delete(self, course_id):
        """
        删除课程（同时清理选课记录）
        :param course_id: 课程 ID
        :return: 删除的课程行数
        """
        with Database() as db:
            db.execute("DELETE FROM student_course WHERE course_id = %s", (course_id,))
            return db.execute("DELETE FROM courses WHERE id = %s", (course_id,))

    def get_open(self, course_id):
        """查询课程开课状态"""
        with Database() as db:
            return db.query_one(
                "SELECT status FROM courses WHERE id=%s",
                (course_id,)
            )

    def get_mode(self, course_id):
        """查询课程授课方式"""
        with Database() as db:
            return db.query_one(
                "SELECT mode FROM courses WHERE id=%s",
                (course_id,)
            )

    def get_capacity(self, course_id):
        """查询课程人数上限"""
        with Database() as db:
            return db.query_one(
                "SELECT max_students FROM courses WHERE id=%s",
                (course_id,)
            )


class StudentCourseModel:
    """选课表（学生选课）数据访问"""

    def get_students_by_course(self, course_id):
        """
        查询某课程已选的学生（含学生姓名和成绩），供成绩登记使用
        :param course_id: 课程 ID
        :return: [{student_id, student_name, grade, score}, ...]
        """
        with Database() as db:
            return db.query_all(
                "SELECT sc.student_id, s.name AS student_name, s.grade, sc.score "
                "FROM student_course sc "
                "JOIN students s ON sc.student_id = s.id "
                "WHERE sc.course_id = %s AND s.is_deleted = 0 "
                "ORDER BY sc.student_id", (course_id,)
            )

    def get_courses_by_student(self, student_id):
        """
        查询某学生已选的课程（关联课程名和教师名）
        :param student_id: 学生 ID
        :return: 已选课程行字典列表（含 course_name/credit/teacher_name/score）
        """
        with Database() as db:
            return db.query_all(
                "SELECT sc.*, c.name AS course_name, c.credit, "
                "       t.name AS teacher_name "
                "FROM student_course sc "
                "JOIN courses c ON sc.course_id = c.id "
                "LEFT JOIN teachers t ON c.teacher_id = t.id "
                "WHERE sc.student_id = %s", (student_id,)
            )

    def is_selected(self, student_id, course_id):
        """
        判断学生是否已选该课程（防止重复选课）
        :return: True 表示已选
        """
        with Database() as db:
            return db.query_one(
                "SELECT * FROM student_course WHERE student_id=%s AND course_id=%s",
                (student_id, course_id)
            ) is not None

    def select(self, student_id, course_id):
        """
        学生选课
        :return: 新选课记录自增 ID
        """
        with Database() as db:
            return db.insert(
                "INSERT INTO student_course (student_id, course_id) VALUES (%s, %s)",
                (student_id, course_id)
            )

    def count_by_student(self, student_id):
        """
        查询某学生已选课程数量（用于"每个学生至少选 1 门"约束）
        :param student_id: 学生 ID
        :return: 已选课程数
        """
        with Database() as db:
            return db.query_one(
                "SELECT COUNT(*) AS cnt FROM student_course WHERE student_id=%s",
                (student_id,)
            )["cnt"]

    def students_with_only_this_course(self, course_id):
        """
        查询"只选了这一门课程"的学生（用于删除课程时防学生无课可选）
        :param course_id: 课程 ID
        :return: [{student_id, student_name}, ...]
        """
        with Database() as db:
            return db.query_all(
                "SELECT sc.student_id, s.name AS student_name "
                "FROM student_course sc "
                "JOIN students s ON sc.student_id = s.id "
                "WHERE sc.course_id = %s AND s.is_deleted = 0 "
                "  AND (SELECT COUNT(*) FROM student_course sc2 "
                "       WHERE sc2.student_id = sc.student_id) = 1",
                (course_id,)
            )

    def unselect(self, student_id, course_id):
        """
        学生退课
        :return: 受影响行数
        """
        with Database() as db:
            return db.execute(
                "DELETE FROM student_course WHERE student_id=%s AND course_id=%s",
                (student_id, course_id)
            )

    def set_score(self, student_id, course_id, score):
        """
        登记成绩
        :return: 受影响行数
        """
        with Database() as db:
            return db.execute(
                "UPDATE student_course SET score=%s WHERE student_id=%s AND course_id=%s",
                (score, student_id, course_id)
            )
