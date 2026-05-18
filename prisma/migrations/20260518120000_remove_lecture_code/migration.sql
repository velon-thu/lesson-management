-- 去掉讲义「编号」字段（同时移除其唯一索引）
ALTER TABLE "lectures" DROP COLUMN "code";
