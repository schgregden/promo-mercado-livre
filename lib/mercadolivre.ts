import { cookies } from "next/headers";
import { Promotion } from "@/types/promotion";

/**
 * Server-only integration with the official Mercado Livre API.
 * Never import this file from a Client Component — it handles
 * MELI_CLIENT_SECRET and access/refresh tokens.
 */

const AUTH_URL = "https://auth.mercadolivre.com.br/authorization";
const TOKEN_URL = "https://api.mercadolibre.com/oauth/token";
const API_BASE_URL = "https://api.mercadolibre.com";
const TOKEN_COOKIE = "meli_tokens";
// Mercado Livre's item multiget endpoint accepts a maximum of 20 ids per call.
const ITEMS_PER_REQUEST = 20;

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token?: string;
}

interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

interface MercadoLivreItem {
  id: string;
  title: string;
  price: number;
  original_price?: number | null;
  currency_id: string;
  permalink: string;
  thumbnail?: string | null;
  secure_thumbnail?: string | null;
  pictures?: { secure_url: string }[];
}

interface MultigetEntry {
  code: number;
  body: MercadoLivreItem;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function buildAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: requireEnv("MELI_CLIENT_ID"),
    redirect_uri: requireEnv("MELI_REDIRECT_URI"),
    state,
  });

  return `${AUTH_URL}?${params.toString()}`;
}

async function requestToken(body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Mercado Livre token request failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  return requestToken({
    grant_type: "authorization_code",
    client_id: requireEnv("MELI_CLIENT_ID"),
    client_secret: requireEnv("MELI_CLIENT_SECRET"),
    code,
    redirect_uri: requireEnv("MELI_REDIRECT_URI"),
  });
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return requestToken({
    grant_type: "refresh_token",
    client_id: requireEnv("MELI_CLIENT_ID"),
    client_secret: requireEnv("MELI_CLIENT_SECRET"),
    refresh_token: refreshToken,
  });
}

export async function storeTokens(tokens: TokenResponse): Promise<void> {
  const stored: StoredTokens = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };

  try {
    const cookieStore = await cookies();
    cookieStore.set(TOKEN_COOKIE, JSON.stringify(stored), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  } catch (error) {
    // Server Components can only read cookies, not write them. If a token
    // refresh happens during the initial SSR render (app/page.tsx), the
    // refreshed token is still used for that request; it gets persisted on
    // the next request that goes through a Route Handler (/api/promotions).
    console.warn("Não foi possível persistir os tokens do Mercado Livre nesta requisição:", error);
  }
}

async function getStoredTokens(): Promise<StoredTokens | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(TOKEN_COOKIE)?.value;
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

async function getValidAccessToken(): Promise<string> {
  const stored = await getStoredTokens();

  if (!stored) {
    throw new Error(
      "Nenhuma conta do Mercado Livre autorizada. Acesse /api/auth/mercadolivre para autorizar."
    );
  }

  const isExpiringSoon = Date.now() > stored.expiresAt - 60_000;
  if (!isExpiringSoon) {
    return stored.accessToken;
  }

  if (!stored.refreshToken) {
    throw new Error(
      "Token do Mercado Livre expirado e sem refresh_token disponível. Autorize novamente em /api/auth/mercadolivre."
    );
  }

  const refreshed = await refreshAccessToken(stored.refreshToken);
  await storeTokens(refreshed);
  return refreshed.access_token;
}

function pickImage(item: MercadoLivreItem): string {
  return item.secure_thumbnail || item.pictures?.[0]?.secure_url || item.thumbnail || "";
}

function transformItem(item: MercadoLivreItem): Promotion {
  const hasDiscount =
    typeof item.original_price === "number" && item.original_price > item.price;

  const discountPercentage = hasDiscount
    ? Math.round(((item.original_price! - item.price) / item.original_price!) * 100)
    : null;

  return {
    id: item.id,
    name: item.title,
    image: pickImage(item),
    currentPrice: item.price,
    previousPrice: hasDiscount ? item.original_price! : null,
    discountPercentage,
    store: "Mercado Livre",
    productUrl: item.permalink,
    // A API de itens do Mercado Livre não retorna cupons de desconto.
    coupon: null,
  };
}

function getConfiguredItemIds(): string[] {
  const raw = requireEnv("MELI_ITEM_IDS");
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    throw new Error("MELI_ITEM_IDS está vazio.");
  }

  return ids;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function fetchItemsByIds(ids: string[], accessToken: string): Promise<MercadoLivreItem[]> {
  const batches = chunk(ids, ITEMS_PER_REQUEST);
  const items: MercadoLivreItem[] = [];

  for (const batch of batches) {
    const url = `${API_BASE_URL}/items?ids=${batch.join(",")}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Mercado Livre items request failed (${response.status}): ${errorBody}`);
    }

    const entries: MultigetEntry[] = await response.json();

    for (const entry of entries) {
      if (entry.code === 200 && entry.body) {
        items.push(entry.body);
      } else {
        console.error("Mercado Livre item indisponível:", entry);
      }
    }
  }

  return items;
}

export async function fetchMercadoLivrePromotions(): Promise<Promotion[]> {
  const accessToken = await getValidAccessToken();
  const ids = getConfiguredItemIds();
  const items = await fetchItemsByIds(ids, accessToken);
  return items.map(transformItem);
}
