import postgres from "postgres";
import dotenv from "dotenv";
dotenv.config();

const connectionString = process.env.SB_POSTGRES_URL_NO_SSL;
const sql = postgres(process.env.SB_POSTGRES_URL);

console.log(`Connection String: ${connectionString}`);
console.log(`NO SSL-${process.env.DB_POSTGRES_URL_NO_SSL}`);
console.log(process.env.DB_POSTGRES_URL_BASEURL);
async function setupDB() {
    console.log("Database Connected");
    console.log("Starting DB...");
    try {
        await sql`
        CREATE TABLE IF NOT EXISTS files (
            id SERIAL PRIMARY KEY,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            file_name TEXT NOT NULL UNIQUE)`
        ;  } catch (err) {
        console.error(err);
    }
}

export { sql, setupDB };