CREATE TYPE "LectureStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "TaskStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'REVIEWING', 'COMPLETED');

ALTER TABLE "lectures"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "chapter" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "deadline" TIMESTAMP(3),
  ADD COLUMN "template_path" TEXT NOT NULL DEFAULT 'templates/default/main.tex',
  ADD COLUMN "status" "LectureStatus" NOT NULL DEFAULT 'DRAFT';

UPDATE "lectures"
SET
  "code" = CASE
    WHEN "id" = 'admin-demo-lecture' THEN 'L00'
    WHEN "id" = 'teacher-demo-lecture' THEN 'L01'
    ELSE 'L-' || SUBSTRING("id", 1, 8)
  END,
  "chapter" = CASE
    WHEN COALESCE("chapter", '') = '' THEN '示例章节'
    ELSE "chapter"
  END,
  "template_path" = CASE
    WHEN COALESCE("template_path", '') = '' THEN 'templates/default/main.tex'
    ELSE "template_path"
  END,
  "status" = 'ACTIVE'
WHERE "code" IS NULL;

ALTER TABLE "lectures"
  ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX "lectures_code_key" ON "lectures"("code");

ALTER TABLE "tasks"
  ADD COLUMN "assignee_id" TEXT,
  ADD COLUMN "branch_name" TEXT,
  ADD COLUMN "status" "TaskStatus" NOT NULL DEFAULT 'ASSIGNED';

UPDATE "tasks"
SET
  "assignee_id" = CASE
    WHEN "id" = 'teacher-demo-task' THEN (SELECT "id" FROM "users" WHERE "username" = 'teacher' LIMIT 1)
    ELSE "created_by_id"
  END,
  "branch_name" = 'task/' || "id"
WHERE "assignee_id" IS NULL OR "branch_name" IS NULL;

ALTER TABLE "tasks"
  ALTER COLUMN "assignee_id" SET NOT NULL,
  ALTER COLUMN "branch_name" SET NOT NULL;

CREATE UNIQUE INDEX "tasks_branch_name_key" ON "tasks"("branch_name");
CREATE INDEX "tasks_assignee_id_idx" ON "tasks"("assignee_id");

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_assignee_id_fkey"
  FOREIGN KEY ("assignee_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
