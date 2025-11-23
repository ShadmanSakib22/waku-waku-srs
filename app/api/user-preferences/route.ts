// app/api/user-preferences/route.ts

import { NextRequest } from "next/server";
import { db } from "@/lib/firebase-admin";
import { getCurrentUser } from "@/lib/auth-server";

const APP_SLUG = process.env.NEXT_PUBLIC_APP_SLUG;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { dailyNewCardLimit } = await req.json();

  await db.doc(`artifacts/${APP_SLUG}/users/${user.uid}/preferences/study`).set(
    {
      dailyNewCardLimit,
    },
    { merge: true }
  );

  return new Response("Saved", { status: 200 });
}
