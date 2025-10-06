// lib/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import "dotenv/config";

// lib/db/index.ts
export { db } from './drizzle';
export * from './schema';

