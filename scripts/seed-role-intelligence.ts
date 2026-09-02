import { config } from "dotenv";
import { ROLE_INTELLIGENCE_FIXTURES } from "../src/lib/ai/role-intelligence-fixtures";
import { importRoleKnowledgeProfiles } from "../src/lib/ai/role-intelligence-ingestion";

config({ path: ".env.local" });

async function main() {
  await importRoleKnowledgeProfiles(ROLE_INTELLIGENCE_FIXTURES);
  console.log(`Imported ${ROLE_INTELLIGENCE_FIXTURES.length} initial role-intelligence profiles.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
