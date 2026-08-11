-- ============================================================
-- EAMS 学校教务管理系统 建表脚本
-- 数据库：school_db
-- 执行方式：mysql -uroot -p < init.sql
-- ============================================================

SET NAMES utf8mb4;

-- 创建数据库
CREATE DATABASE IF NOT EXISTS school_db DEFAULT CHARSET utf8mb4;
USE school_db;

-- ============================================================
-- 1. 用户表（学生注册登录 + 管理员）
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id          INT          PRIMARY KEY AUTO_INCREMENT COMMENT '用户ID',
    username    VARCHAR(50)  NOT NULL UNIQUE           COMMENT '用户名（登录账号）',
    password    VARCHAR(100) NOT NULL                  COMMENT '密码（明文存储，教学演示）',
    role        VARCHAR(20)  DEFAULT 'student'         COMMENT '角色：student / admin',
    student_id  INT                                    COMMENT '关联的学生ID（学生角色时使用）',
    create_time DATETIME     DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
) COMMENT '用户表';

-- ============================================================
-- 2. 教师表
-- ============================================================
CREATE TABLE IF NOT EXISTS teachers (
    id          INT         PRIMARY KEY AUTO_INCREMENT COMMENT '教师ID',
    name        VARCHAR(50) NOT NULL                    COMMENT '教师姓名',
    gender      VARCHAR(10)                             COMMENT '性别',
    age         INT                                     COMMENT '年龄',
    subject     VARCHAR(50)                             COMMENT '教授科目',
    phone       VARCHAR(20)                             COMMENT '联系电话',
    zhicheng_id INT                                     COMMENT '职称ID（zhicheng 表）',
    base_salary DECIMAL(10,2)                           COMMENT '基本工资（月薪）',
    class_fee   DECIMAL(10,2)                           COMMENT '课时费（每学生单价，课时费=单价×所带学生数）',
    bonus       DECIMAL(10,2)                           COMMENT '奖金/津贴',
    education   VARCHAR(20)                             COMMENT '学历：本科/硕士/博士',
    hire_date   DATE                                    COMMENT '入职日期',
    remark      VARCHAR(255)                            COMMENT '备注',
    create_time DATETIME    DEFAULT CURRENT_TIMESTAMP   COMMENT '创建时间'
) COMMENT '教师表';

-- ============================================================
-- 3. 班级表（学生分班）
-- ============================================================
CREATE TABLE IF NOT EXISTS classes (
    id              INT         PRIMARY KEY AUTO_INCREMENT COMMENT '班级ID',
    name            VARCHAR(50) NOT NULL                    COMMENT '班级名称，如：高一(1)班',
    grade           VARCHAR(20)                             COMMENT '年级：高一/高二/高三',
    head_teacher_id INT                                     COMMENT '班主任教师ID',
    create_time     DATETIME    DEFAULT CURRENT_TIMESTAMP   COMMENT '创建时间'
) COMMENT '班级表';

-- ============================================================
-- 4. 学生表（含选老师、分班、回收站）
-- ============================================================
CREATE TABLE IF NOT EXISTS students (
    id              INT         PRIMARY KEY AUTO_INCREMENT COMMENT '学生ID',
    name            VARCHAR(50) NOT NULL                    COMMENT '学生姓名',
    gender          VARCHAR(10)                             COMMENT '性别',
    age             INT                                     COMMENT '年龄',
    grade           VARCHAR(20)                             COMMENT '年级',
    class_id        INT                                     COMMENT '所属班级ID（分班）',
    teacher_id      INT                                     COMMENT '所属教师ID（选老师）',
    enrollment_date DATE                                    COMMENT '入学日期',
    is_deleted      TINYINT(1)  DEFAULT 0                   COMMENT '是否删除 0-正常 1-回收站',
    delete_time     DATETIME    DEFAULT NULL                COMMENT '删除时间',
    delete_operator VARCHAR(50) DEFAULT NULL                COMMENT '删除操作人',
    create_time     DATETIME    DEFAULT CURRENT_TIMESTAMP   COMMENT '创建时间'
) COMMENT '学生表';

-- ============================================================
-- 5. 课程表（教师授课）
-- ============================================================
CREATE TABLE IF NOT EXISTS courses (
    id           INT         PRIMARY KEY AUTO_INCREMENT COMMENT '课程ID',
    name         VARCHAR(50) NOT NULL                    COMMENT '课程名称',
    credit       INT         DEFAULT 1                   COMMENT '学分',
    teacher_id   INT                                     COMMENT '授课教师ID',
    status       VARCHAR(10) DEFAULT '开课'              COMMENT '开课状态：开课/未开课',
    mode         VARCHAR(10) DEFAULT '线下'              COMMENT '授课方式：线上/线下',
    max_students INT         DEFAULT NULL                COMMENT '课程人数上限（NULL=不限制）',
    create_time  DATETIME    DEFAULT CURRENT_TIMESTAMP   COMMENT '创建时间'
) COMMENT '课程表';

-- ============================================================
-- 6. 职称表（教师职称：初级/中级/副高级/高级）
-- ============================================================
CREATE TABLE IF NOT EXISTS zhicheng (
    id          INT         PRIMARY KEY AUTO_INCREMENT COMMENT '职称ID',
    name        VARCHAR(50) NOT NULL                    COMMENT '职称名称，如：初级/中级/副高级/高级',
    level       INT         DEFAULT 1                   COMMENT '级别：数值越大等级越高（1初级 2中级 3副高级 4高级）',
    description VARCHAR(200)                            COMMENT '职称说明',
    create_time DATETIME    DEFAULT CURRENT_TIMESTAMP   COMMENT '创建时间'
) COMMENT '职称表';

-- ============================================================
-- 7. 选课表（学生选课，多对多）
-- ============================================================
CREATE TABLE IF NOT EXISTS student_course (
    id          INT         PRIMARY KEY AUTO_INCREMENT COMMENT '选课记录ID',
    student_id  INT         NOT NULL                    COMMENT '学生ID',
    course_id   INT         NOT NULL                    COMMENT '课程ID',
    score       DECIMAL(5,2)                            COMMENT '成绩',
    create_time DATETIME    DEFAULT CURRENT_TIMESTAMP   COMMENT '选课时间',
    UNIQUE KEY uk_student_course (student_id, course_id) COMMENT '同一学生同一课程只能选一次'
) COMMENT '选课表';

-- ============================================================
-- 示例数据
-- ============================================================

-- 教师示例（职称：2中级/3副高级/4高级，职称越高薪资越高、所带年级越高：中级→高一、副高级→高二、高级→高三）
INSERT INTO teachers (name, gender, age, subject, phone, zhicheng_id, base_salary, class_fee, bonus, education, hire_date, remark) VALUES
    ('张老师', '男', 32, '数学', '13800138001', 2, 9000.00, 60.00, 2000.00, '硕士', '2018-09-01', '数学教研组组长，高一(1)班班主任'),
    ('李老师', '女', 30, '语文', '13800138002', 2, 9000.00, 60.00, 2000.00, '硕士', '2019-09-01', '高一(2)班班主任'),
    ('王老师', '男', 38, '英语', '13800138003', 3, 11000.00, 70.00, 2800.00, '硕士', '2013-09-01', '英语备课组组长，高二(1)班班主任'),
    ('赵老师', '女', 36, '物理', '13800138004', 3, 11000.00, 70.00, 2800.00, '本科', '2014-09-01', '高二(2)班班主任'),
    ('孙老师', '男', 45, '化学', '13800138005', 4, 13500.00, 85.00, 3500.00, '博士', '2008-09-01', '化学教研组组长，高三(1)班班主任'),
    ('周老师', '女', 43, '生物', '13800138006', 4, 13500.00, 85.00, 3500.00, '博士', '2009-09-01', '高三(2)班班主任');

-- 班级示例（每班班主任固定，职称越高所带年级越高：中级→高一、副高级→高二、高级→高三）
INSERT INTO classes (name, grade, head_teacher_id) VALUES
    ('高一(1)班', '高一', 1),
    ('高一(2)班', '高一', 2),
    ('高二(1)班', '高二', 3),
    ('高二(2)班', '高二', 4),
    ('高三(1)班', '高三', 5),
    ('高三(2)班', '高三', 6);

-- 学生示例（学生老师 = 所选课程的授课教师，通过选课表关联；年龄随年级：高一15 高二16 高三17）
INSERT INTO students (name, gender, age, grade, class_id, enrollment_date) VALUES
    ('张三', '男', 15, '高一', 1, '2025-09-01'),
    ('李四', '女', 15, '高一', 1, '2025-09-01'),
    ('王五', '男', 15, '高一', 1, '2025-09-01'),
    ('赵六', '女', 15, '高一', 2, '2025-09-01'),
    ('孙七', '男', 15, '高一', 2, '2025-09-01'),
    ('周八', '女', 15, '高一', 2, '2025-09-01'),
    ('吴九', '男', 16, '高二', 3, '2024-09-01'),
    ('郑十', '女', 16, '高二', 3, '2024-09-01'),
    ('钱一', '男', 16, '高二', 3, '2024-09-01'),
    ('冯二', '女', 16, '高二', 4, '2024-09-01'),
    ('陈三', '男', 16, '高二', 4, '2024-09-01'),
    ('褚四', '女', 16, '高二', 4, '2024-09-01'),
    ('卫五', '男', 17, '高三', 5, '2023-09-01'),
    ('蒋六', '女', 17, '高三', 5, '2023-09-01'),
    ('沈七', '男', 17, '高三', 5, '2023-09-01'),
    ('韩八', '女', 17, '高三', 6, '2023-09-01'),
    ('杨九', '男', 17, '高三', 6, '2023-09-01'),
    ('朱十', '女', 17, '高三', 6, '2023-09-01');

-- 课程示例（数学/语文/英语/物理/化学/生物，对应授课教师）
INSERT INTO courses (name, credit, teacher_id, status, mode, max_students) VALUES
    ('数学', 4, 1, '开课', '线下', 50),
    ('语文', 4, 2, '开课', '线下', 50),
    ('英语', 3, 3, '开课', '线下', 45),
    ('物理', 3, 4, '开课', '线下', 40),
    ('化学', 3, 5, '开课', '线下', 40),
    ('生物', 2, 6, '开课', '线下', 35);

-- 选课示例：18 名学生每人均选 1-3 门课程（每个学生至少选 1 门；教师所带学生数有差异，体现课时费随带生数增长）
INSERT INTO student_course (student_id, course_id) VALUES
    (1, 1), (1, 2), (1, 5),
    (2, 1), (2, 3),
    (3, 4), (3, 6),
    (4, 1), (4, 3),
    (5, 2), (5, 4),
    (6, 5),
    (7, 1), (7, 2),
    (8, 3),
    (9, 4), (9, 6),
    (10, 1), (10, 5),
    (11, 2), (11, 3),
    (12, 6),
    (13, 1), (13, 4),
    (14, 2), (14, 5),
    (15, 3), (15, 6),
    (16, 1), (16, 2), (16, 3),
    (17, 4), (17, 5),
    (18, 6);

-- 职称示例（初级1 中级2 副高级3 高级4，数值越大等级越高）
INSERT INTO zhicheng (name, level, description) VALUES
    ('初级', 1, '初级职称，一般承担辅助教学任务'),
    ('中级', 2, '中级职称，独立承担课程教学'),
    ('副高级', 3, '副高级职称，承担主干课程与科研项目'),
    ('高级', 4, '高级职称，主持学科建设与高水平课题');

-- 管理员账号（密码 admin123，明文存储，教学演示）
INSERT INTO users (username, password, role) VALUES
    ('admin', 'admin123', 'admin');
