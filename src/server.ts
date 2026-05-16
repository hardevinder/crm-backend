import { buildApp } from "./app.js";
import { env } from "./config/env.js";

async function startServer() {
  try {
    const app = await buildApp();

    const port = Number(env.PORT || 5005);
    const host = "0.0.0.0";

    await app.listen({
      port,
      host,
    });

    app.log.info(`Edubridge CRM API running on http://localhost:${port}`);
    app.log.info(app.printRoutes());
  } catch (error) {
    console.error("Failed to start Edubridge CRM API:", error);
    process.exit(1);
  }
}

void startServer();
