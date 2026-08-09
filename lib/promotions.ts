import { Promotion } from "@/types/promotion";
import { fetchMercadoLivreDeals } from "@/lib/mercadolivreDeals";

export async function fetchPromotions(): Promise<Promotion[]> {
  return fetchMercadoLivreDeals();
}
