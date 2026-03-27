import { CosmosClient } from "@azure/cosmos";
import { Client as PgClient } from "pg";
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

interface Donor {
  id: string;
  bloodType: string;
  lastDonationDate: string;
  weightKg: number;
  isEligible: boolean;
  location: { lat: number; lng: number };
  phone: string;
  hospitalId: string;
  fhirPatientId: string;
}

async function seedCosmosBloodBanks(banks: BloodBank[]): Promise<void> {
  const connectionString = process.env.COSMOS_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("COSMOS_CONNECTION_STRING is not set");
  }

  const client = new CosmosClient(connectionString);
  const databaseName = process.env.COSMOS_DATABASE_NAME ?? "hemosync";
  const containerName = process.env.COSMOS_BLOOD_BANKS_CONTAINER ?? "blood-banks";

  const { database } = await client.databases.createIfNotExists({ id: databaseName });
  const { container } = await database.containers.createIfNotExists({
    id: containerName,
    partitionKey: { paths: ["/id"] },
  });

  console.log(`Seeding ${banks.length} blood banks into Cosmos DB...`);
  let seeded = 0;

  for (const bank of banks) {
    try {
      const { resource: existing } = await container.item(bank.id, bank.id).read();
      if (existing) {
        console.log(`  ~ Skipped (exists): ${bank.name}`);
        continue;
      }
    } catch {
      // item not found — proceed with upsert
    }

    await container.items.upsert(bank);
    console.log(`  + ${bank.name}`);
    seeded++;
  }

  console.log(`Seeding complete. ${seeded} new banks loaded (${banks.length - seeded} skipped).\n`);
}

async function seedPostgresDonors(donors: Donor[], pgClient: PgClient): Promise<void> {
  console.log(`Seeding ${donors.length} donors into PostgreSQL...`);
  let seeded = 0;

  for (const donor of donors) {
    const { rows } = await pgClient.query(
      "SELECT id FROM donor_reference WHERE id = $1",
      [donor.id]
    );

    if (rows.length > 0) {
      console.log(`  ~ Skipped (exists): ${donor.id}`);
      continue;
    }

    await pgClient.query(
      `INSERT INTO donor_reference
        (id, blood_type, last_donation_date, weight_kg, is_eligible, lat, lng, phone, hospital_id, fhir_patient_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        donor.id,
        donor.bloodType,
        donor.lastDonationDate,
        donor.weightKg,
        donor.isEligible,
        donor.location.lat,
        donor.location.lng,
        donor.phone,
        donor.hospitalId,
        donor.fhirPatientId,
      ]
    );
    console.log(`  + ${donor.id} (${donor.bloodType})`);
    seeded++;
  }

  console.log(`Donors seeded. ${seeded} new records inserted (${donors.length - seeded} skipped).\n`);
}

async function ensureDonorReferenceTable(pgClient: PgClient): Promise<void> {
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS donor_reference (
      id                TEXT PRIMARY KEY,
      blood_type        TEXT NOT NULL,
      last_donation_date DATE,
      weight_kg         INTEGER,
      is_eligible       BOOLEAN DEFAULT TRUE,
      lat               DOUBLE PRECISION,
      lng               DOUBLE PRECISION,
      phone             TEXT,
      hospital_id       TEXT,
      fhir_patient_id   TEXT,
      created_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function main(): Promise<void> {
  const seedDir = path.join(__dirname);
  const banks: BloodBank[] = JSON.parse(
    fs.readFileSync(path.join(seedDir, "dev-blood-banks.json"), "utf-8")
  );
  const donors: Donor[] = JSON.parse(
    fs.readFileSync(path.join(seedDir, "dev-donors.json"), "utf-8")
  );

  // Cosmos DB — blood banks
  await seedCosmosBloodBanks(banks);

  // PostgreSQL — donors reference table
  const pgClient = new PgClient({
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: parseInt(process.env.POSTGRES_PORT ?? "5432", 10),
    database: process.env.POSTGRES_DATABASE ?? "hemosync_audit",
    user: process.env.POSTGRES_USER ?? "hemosync",
    password: process.env.POSTGRES_PASSWORD,
    ssl: process.env.POSTGRES_SSL_MODE === "require" ? { rejectUnauthorized: false } : false,
  });

  await pgClient.connect();
  await ensureDonorReferenceTable(pgClient);
  await seedPostgresDonors(donors, pgClient);
  await pgClient.end();

  console.log("All seed data loaded successfully.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
