import "server-only";

import { init } from "@instantdb/admin";
import schema from "@/instant.schema";

type AdminDb = ReturnType<typeof createAdminDb>;

let adminDb: AdminDb | null = null;

function requireEnv(name: "INSTANT_ADMIN_TOKEN" | "NEXT_PUBLIC_INSTANT_APP_ID") {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

export function getAdminDb() {
  if (!adminDb) {
    adminDb = createAdminDb();
  }

  return adminDb;
}

export const db = new Proxy({} as AdminDb, {
  get(_target, property, receiver) {
    return Reflect.get(getAdminDb(), property, receiver);
  },
});

function createAdminDb() {
  return init({
    adminToken: requireEnv("INSTANT_ADMIN_TOKEN"),
    appId: requireEnv("NEXT_PUBLIC_INSTANT_APP_ID"),
    schema,
  });
}
