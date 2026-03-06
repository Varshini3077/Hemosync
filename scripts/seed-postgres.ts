import { Client as PgClient } from "pg";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const MIGRATIONS_DIR = path.join(__dirname, "../db/migrations");
const MIGRATION_FILES = [
  "001_create_audit_log.sql",
  "002_create_donor_outreach.sql",
  "003_create_analytics_events.sql",
];

async function runMigrations(client: PgClient): Promise<void> {
  console.log("Running migrations...");
  for (const file of MIGRATION_FILES) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, "utf-8");

    // Extract the -- migrate:up section only
    const upSection = sql.split("-- migrate:down")[0].replace("-- migrate:up", "").trim();
    await client.query(upSection);
    console.log(`  + Applied: ${file}`);
  }
  console.log("Migrations complete.\n");
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

async function seedDonors(client: PgClient): Promise<void> {
  const seedFile = path.join(__dirname, "../db/seeds/dev-donors.json");
  const donors: Donor[] = JSON.parse(fs.readFileSync(seedFile, "utf-8"));

  // Ensure donor_reference table exists for seed data
  await client.query(`
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

  console.log(`Seeding ${donors.length} donor records...`);
  let seeded = 0;
  let skipped = 0;

  for (const donor of donors) {
    const { rows } = await client.query("SELECT id FROM donor_reference WHERE id = $1", [donor.id]);
    if (rows.length > 0) {
      skipped++;
      continue;
    }

    await client.query(
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

  console.log(`Donors seeded. ${seeded} inserted, ${skipped} skipped.\n`);
}

async function main(): Promise<void> {
  const client = new PgClient({
    connectionString: process.env.DATABASE_URL,
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: parseInt(process.env.POSTGRES_PORT ?? "5432", 10),
    database: process.env.POSTGRES_DATABASE ?? "hemosync_audit",
    user: process.env.POSTGRES_USER ?? "hemosync",
    password: process.env.POSTGRES_PASSWORD ?? "hemosync_dev",
    ssl:
      process.env.POSTGRES_SSL_MODE === "require"
        ? { rejectUnauthorized: false }
        : false,
  });

  await client.connect();
  console.log("Connected to PostgreSQL.\n");

  await runMigrations(client);
  await seedDonors(client);

  await client.end();
  console.log("PostgreSQL seed complete.");
}

main().catch((err) => {
  console.error("PostgreSQL seed failed:", err.message ?? err);
  process.exit(1);
});
