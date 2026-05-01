import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";

async function start() {
  const app = await buildApp();

  try {
    await app.listen({
      port: env.PORT,
      host: "0.0.0.0",
    });

    console.log(`✅ Edubridge CRM API running on port ${env.PORT}`);
  } catch (error) {
    app.log.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

start();
