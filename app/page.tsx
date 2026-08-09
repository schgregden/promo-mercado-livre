import { Promotion } from "@/types/promotion";
import { fetchPromotions } from "@/lib/promotions";
import PromotionsView from "@/components/PromotionsView";

// This page reads auth cookies and calls the Mercado Livre API on every
// request — it can never be statically prerendered.
export const dynamic = "force-dynamic";

export default async function Home() {
  let initialPromotions: Promotion[] = [];
  let initialError: string | null = null;

  try {
    initialPromotions = await fetchPromotions();
  } catch (error) {
    console.error("Falha ao buscar promoções do Mercado Livre:", error);
    initialError = "Não foi possível carregar as promoções do Mercado Livre.";
  }

  return <PromotionsView initialPromotions={initialPromotions} initialError={initialError} />;
}
