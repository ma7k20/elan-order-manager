import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  // Existing deployments receive these additive columns automatically before
  // the API starts serving requests.
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_percentage numeric(5, 2) NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS coordination_expenses numeric(12, 2) NOT NULL DEFAULT 0`);
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

start().catch((err) => {
  logger.error({ err }, "Failed to prepare database schema");
  process.exit(1);
});
