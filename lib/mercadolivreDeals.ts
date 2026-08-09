import { Promotion } from "@/types/promotion";
import { lookupAffiliateUrl } from "@/lib/affiliateLinks";

/**
 * Public, unauthenticated integration with the Mercado Livre "Ofertas" page
 * (https://www.mercadolivre.com.br/ofertas).
 *
 * There is no documented public search/deals API for third-party apps (the
 * general item-search endpoint is restricted — see lib/mercadolivre.ts).
 * This page, however, server-renders its own product grid into an embedded
 * JSON blob (`window.__NORDIC_RENDERING_CTX__`, i.e. `_n.ctx.r`) that the
 * page's own frontend (app "sp-offers-frontend") uses to hydrate. We parse
 * that same structured data instead of scraping visual HTML elements.
 *
 * Confirmed by hand against a real response before writing this:
 * appProps.pageProps.data.{items,polycardContext,paging}. Not a documented
 * or versioned contract — Mercado Livre can change it without notice.
 */

const OFERTAS_URL = "https://www.mercadolivre.com.br/ofertas";
const MAX_DEALS = 50;
const NORDIC_CTX_MARKER = "__NORDIC_RENDERING_CTX__";
// Mercado Livre returns a 403/anti-bot page for requests without a
// browser-like User-Agent.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface PriceValue {
  value: number;
  previous?: boolean;
}

interface PriceLabelValue {
  type: string;
  price?: PriceValue;
}

interface DealCardComponent {
  type: string;
  title?: { text: string };
  seller?: { values?: { key: string; label?: { text: string } }[] };
  price?: {
    current_price?: PriceValue;
    price_labels?: { values?: PriceLabelValue[] }[];
  };
}

interface DealCard {
  metadata?: { id?: string; url?: string };
  pictures?: { square?: string; pictures?: { id: string }[] };
  components?: DealCardComponent[];
}

interface DealItem {
  card: DealCard;
}

interface PolycardContext {
  picture_template: string;
  picture_size_default: string;
}

interface OfertasPageData {
  items: DealItem[];
  polycardContext: PolycardContext;
  paging?: { total?: number };
}

/** Finds the matching `}` for the `{` at/after `fromIndex`, respecting string literals. */
function extractJsonObject(source: string, fromIndex: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;

  for (let i = fromIndex; i < source.length; i++) {
    const char = source[i];

    if (start === -1) {
      if (char === "{") {
        start = i;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }

  return null;
}

function parseOfertasPageData(html: string): OfertasPageData {
  const markerIndex = html.indexOf(NORDIC_CTX_MARKER);
  if (markerIndex === -1) {
    throw new Error(`Marcador ${NORDIC_CTX_MARKER} não encontrado no HTML de /ofertas.`);
  }

  const scriptStart = html.indexOf(">", markerIndex) + 1;
  const jsonString = extractJsonObject(html, scriptStart);
  if (!jsonString) {
    throw new Error(`Não foi possível extrair o JSON de ${NORDIC_CTX_MARKER}.`);
  }

  const context = JSON.parse(jsonString);
  const data = context?.appProps?.pageProps?.data;
  if (!Array.isArray(data?.items) || !data?.polycardContext?.picture_template) {
    throw new Error("Estrutura inesperada em __NORDIC_RENDERING_CTX__.appProps.pageProps.data.");
  }

  return data as OfertasPageData;
}

function getComponent(card: DealCard, type: string): DealCardComponent | undefined {
  return card.components?.find((c) => c.type === type);
}

function buildImageUrl(card: DealCard, polycardContext: PolycardContext): string | null {
  const picture = card.pictures?.pictures?.[0];
  if (!picture) return null;

  const square = card.pictures?.square || "Q";
  return polycardContext.picture_template
    .replace("{square}", square)
    .replace("{2x}", "")
    .replace("{id}", picture.id)
    .replace("{size}", polycardContext.picture_size_default)
    .replace("{sanitized_title}", "");
}

function extractSellerName(card: DealCard): string {
  const seller = getComponent(card, "seller");
  const label = seller?.seller?.values?.find((v) => v.key === "label");
  return label?.label?.text || "Mercado Livre";
}

function extractPreviousPrice(priceComponent: DealCardComponent): number | null {
  for (const label of priceComponent.price?.price_labels || []) {
    for (const value of label.values || []) {
      if (value.type === "price" && value.price?.previous) {
        return value.price.value;
      }
    }
  }
  return null;
}

function transformDeal(item: DealItem, polycardContext: PolycardContext): Promotion | null {
  const card = item.card;
  const id = card.metadata?.id;
  const rawUrl = card.metadata?.url;
  const title = getComponent(card, "title")?.title?.text;
  const priceComponent = getComponent(card, "price");
  const currentPrice = priceComponent?.price?.current_price?.value;
  const image = buildImageUrl(card, polycardContext);

  if (!id || !title || !rawUrl || typeof currentPrice !== "number" || !image) {
    return null;
  }

  const previousPrice = priceComponent ? extractPreviousPrice(priceComponent) : null;
  const hasDiscount = typeof previousPrice === "number" && previousPrice > currentPrice;
  const discountPercentage = hasDiscount
    ? Math.round(((previousPrice! - currentPrice) / previousPrice!) * 100)
    : null;

  const plainProductUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;

  return {
    id,
    name: title,
    image,
    currentPrice,
    previousPrice: hasDiscount ? previousPrice! : null,
    discountPercentage,
    store: extractSellerName(card),
    // Sends visitors through the affiliate short link when this exact
    // product has one; otherwise falls back to the plain Mercado Livre URL.
    productUrl: lookupAffiliateUrl(plainProductUrl),
    // A página de ofertas mostra um preço já com cupom aplicado em alguns
    // casos, mas não expõe um código de cupom copiável — então não
    // inventamos um valor para este campo.
    coupon: null,
  };
}

export async function fetchMercadoLivreDeals(): Promise<Promotion[]> {
  const response = await fetch(OFERTAS_URL, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });

  console.log(`Mercado Livre ofertas: resposta HTTP ${response.status}`);

  if (!response.ok) {
    const bodyPreview = (await response.text()).slice(0, 300);
    throw new Error(`Mercado Livre ofertas request failed (${response.status}): ${bodyPreview}`);
  }

  const html = await response.text();
  const data = parseOfertasPageData(html);

  const candidates = data.items.slice(0, MAX_DEALS);
  const deals = candidates
    .map((item) => transformDeal(item, data.polycardContext))
    .filter((deal): deal is Promotion => deal !== null);

  console.log(
    `Mercado Livre ofertas: ${deals.length} de ${candidates.length} item(ns) processados com sucesso (total disponível na fonte: ${data.paging?.total ?? "desconhecido"}).`
  );

  return deals;
}
