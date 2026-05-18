const { randomBytes, scryptSync } = require("node:crypto");
const { PrismaClient, UserRole } = require("@prisma/client");

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");

  return `${salt}:${hash}`;
}

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@zjjx.local" },
    update: {
      username: "admin",
      name: "默认管理员",
      role: UserRole.ADMIN,
      isActive: true,
      passwordHash: hashPassword("admin"),
      passwordPlain: "admin",
    },
    create: {
      username: "admin",
      email: "admin@zjjx.local",
      name: "默认管理员",
      role: UserRole.ADMIN,
      isActive: true,
      passwordHash: hashPassword("admin"),
      passwordPlain: "admin",
    },
  });

  const teacher = await prisma.user.upsert({
    where: { email: "teacher@zjjx.local" },
    update: {
      username: "teacher",
      name: "默认老师",
      role: UserRole.TEACHER,
      isActive: true,
      passwordHash: hashPassword("teacher"),
      passwordPlain: "teacher",
    },
    create: {
      username: "teacher",
      email: "teacher@zjjx.local",
      name: "默认老师",
      role: UserRole.TEACHER,
      isActive: true,
      passwordHash: hashPassword("teacher"),
      passwordPlain: "teacher",
    },
  });

  const adminLecture = await prisma.lecture.upsert({
    where: { id: "admin-demo-lecture" },
    update: {
      title: "管理员示例讲次",
      chapter: "示例章节",
      description: "用于权限验证的管理员讲次",
      deadline: new Date("2026-04-15T00:00:00.000Z"),
      templatePath: "templates/default/main.tex",
      status: "ING",
      createdById: admin.id,
    },
    create: {
      id: "admin-demo-lecture",
      title: "管理员示例讲次",
      chapter: "示例章节",
      description: "用于权限验证的管理员讲次",
      deadline: new Date("2026-04-15T00:00:00.000Z"),
      templatePath: "templates/default/main.tex",
      status: "ING",
      createdById: admin.id,
    },
  });

  const teacherLecture = await prisma.lecture.upsert({
    where: { id: "teacher-demo-lecture" },
    update: {
      title: "老师示例讲次",
      chapter: "第 1 章",
      description: "用于权限验证的老师讲次",
      deadline: new Date("2026-04-20T00:00:00.000Z"),
      templatePath: "templates/chapter/main.tex",
      status: "ING",
      createdById: admin.id,
    },
    create: {
      id: "teacher-demo-lecture",
      title: "老师示例讲次",
      chapter: "第 1 章",
      description: "用于权限验证的老师讲次",
      deadline: new Date("2026-04-20T00:00:00.000Z"),
      templatePath: "templates/chapter/main.tex",
      status: "ING",
      createdById: admin.id,
    },
  });

  const adminDraft = await prisma.taskDraft.upsert({
    where: { id: "admin-demo-draft" },
    update: {
      title: "管理员示例讲义草稿",
      texSource: "\\documentclass{article}\n\\begin{document}\n管理员示例讲义\n\\end{document}\n",
      createdById: admin.id,
      lectureId: adminLecture.id,
    },
    create: {
      id: "admin-demo-draft",
      title: "管理员示例讲义草稿",
      texSource: "\\documentclass{article}\n\\begin{document}\n管理员示例讲义\n\\end{document}\n",
      createdById: admin.id,
      lectureId: adminLecture.id,
    },
  });

  const teacherDraft = await prisma.taskDraft.upsert({
    where: { id: "teacher-demo-draft" },
    update: {
      title: "老师示例讲义草稿",
      texSource: "\\documentclass{article}\n\\begin{document}\n老师示例讲义\n\\end{document}\n",
      createdById: admin.id,
      lectureId: teacherLecture.id,
    },
    create: {
      id: "teacher-demo-draft",
      title: "老师示例讲义草稿",
      texSource: "\\documentclass{article}\n\\begin{document}\n老师示例讲义\n\\end{document}\n",
      createdById: admin.id,
      lectureId: teacherLecture.id,
    },
  });

  await prisma.task.upsert({
    where: { id: "admin-demo-task" },
    update: {
      title: "管理员示例任务",
      lectureId: adminLecture.id,
      createdById: admin.id,
      assigneeId: admin.id,
      draftId: adminDraft.id,
      branchName: "task/admin-demo-task",
      status: "ASSIGNED",
    },
    create: {
      id: "admin-demo-task",
      title: "管理员示例任务",
      lectureId: adminLecture.id,
      createdById: admin.id,
      assigneeId: admin.id,
      draftId: adminDraft.id,
      branchName: "task/admin-demo-task",
      status: "ASSIGNED",
    },
  });

  await prisma.task.upsert({
    where: { id: "teacher-demo-task" },
    update: {
      title: "老师示例任务",
      lectureId: teacherLecture.id,
      createdById: admin.id,
      assigneeId: teacher.id,
      draftId: teacherDraft.id,
      branchName: "task/teacher-demo-task",
      status: "ASSIGNED",
    },
    create: {
      id: "teacher-demo-task",
      title: "老师示例任务",
      lectureId: teacherLecture.id,
      createdById: admin.id,
      assigneeId: teacher.id,
      draftId: teacherDraft.id,
      branchName: "task/teacher-demo-task",
      status: "ASSIGNED",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
