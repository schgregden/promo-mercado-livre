import { NextResponse } from "next/server";
import { buildAuthorizationUrl } from "@/lib/mercadolivre";

export async function GET() {
  const state = crypto.randomUUID();
  const authorizationUrl = buildAuthorizationUrl(state);

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set("meli_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
