"use client";

import { db } from "./instant";

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const user = await db.getAuth();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${user.refresh_token}`);

  return fetch(input, {
    ...init,
    headers,
  });
}
