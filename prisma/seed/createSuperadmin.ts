import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@edubridgeerp.in";
  const password = "Admin@12345";

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    console.log("Superadmin already exists");
    return;
  }

  await prisma.user.create({
    data: {
      name: "Edubridge Superadmin",
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: "superadmin",
      status: "active",
    },
  });

  console.log("✅ Superadmin created");
  console.log("Email:", email);
  console.log("Password:", password);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
