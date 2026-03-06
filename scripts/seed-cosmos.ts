import { CosmosClient } from "@azure/cosmos";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

interface BloodBank {
  id: string;
  name: string;
  phone: string;
  address: string;
  location: { lat: number; lng: number; city: string };
  reliabilityScore: number;
  isActive: boolean;
}

async function main(): Promise<void> {
  const connectionString = process.env.AZURE_COSMOS_CONNECTION_STRING ?? process.env.COSMOS_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("AZURE_COSMOS_CONNECTION_STRING is not set");
  }

  const databaseName = process.env.COSMOS_DATABASE_NAME ?? "hemosync";
  const containerName = process.env.COSMOS_BLOOD_BANKS_CONTAINER ?? "blood-banks";

  const seedFile = path.join(__dirname, "../db/seeds/dev-blood-banks.json");
  const banks: BloodBank[] = JSON.parse(fs.readFileSync(seedFile, "utf-8"));

  const client = new CosmosClient(connectionString);
  const { database } = await client.databases.createIfNotExists({ id: databaseName });
  const { container } = await database.containers.createIfNotExists({
    id: containerName,
    partitionKey: { paths: ["/id"] },
  });

  console.log(`Seeding ${banks.length} blood banks...`);

  let seeded = 0;
  let skipped = 0;

  for (const bank of banks) {
    try {
      const { resource: existing } = await container.item(bank.id, bank.id).read();
      if (existing) {
        skipped++;
        continue;
      }
    } catch {
      // not found — proceed
    }

    await container.items.upsert(bank);
    console.log(`  + ${bank.name}`);
    seeded++;
  }

  console.log(`Seeding complete. ${seeded} banks loaded (${skipped} already existed).`);
}

main().catch((err) => {
  console.error("Cosmos seed failed:", err.message ?? err);
  process.exit(1);
});
