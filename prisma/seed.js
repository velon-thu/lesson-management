const { PrismaClient, UserRole } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: "admin@zjjx.local" },
    update: {
      name: "默认管理员",
      role: UserRole.ADMIN,
      isActive: true,
    },
    create: {
      email: "admin@zjjx.local",
      name: "默认管理员",
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "teacher@zjjx.local" },
    update: {
      name: "默认老师",
      role: UserRole.TEACHER,
      isActive: true,
    },
    create: {
      email: "teacher@zjjx.local",
      name: "默认老师",
      role: UserRole.TEACHER,
      isActive: true,
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
