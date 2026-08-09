import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, storeTokens } from "@/lib/mercadolivre";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get("meli_oauth_state")?.value;
  const homeUrl = new URL("/", request.url);

  const response = NextResponse.redirect(homeUrl);
  response.cookies.delete("meli_oauth_state");

  if (!code || !state || !expectedState || state !== expectedState) {
    console.error(
      "Mercado Livre OAuth callback inválido: parâmetros ausentes ou state não confere."
    );
    return response;
  }

  try {
    const tokens = await exchangeCodeForToken(code);
    await storeTokens(tokens);
  } catch (error) {
    console.error("Falha ao trocar o código de autorização por um token do Mercado Livre:", error);
  }

  return response;
}
