import { seed } from "../packages/db/src/seed";
import { createTestDatabase } from "../packages/db/src/test-support";

const handle = await createTestDatabase();

try {
  await seed(handle.db);
  // The runner consumes stdout, so keep it machine-readable and free of logs.
  process.stdout.write(handle.url);
} finally {
  await handle.close();
}
