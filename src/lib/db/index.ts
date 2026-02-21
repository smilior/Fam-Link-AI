import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const client = process.env.TURSO_CONNECTION_URL
  ? createClient({
      url: process.env.TURSO_CONNECTION_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  : null;

export const db = client ? drizzle(client, { schema }) : null;

export function getDb() {
  if (!db) {
    throw new Error("Database not initialized. Check TURSO_CONNECTION_URL.");
  }
  return db;
}
