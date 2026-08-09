import { Promotion } from "@/types/promotion";
import { fetchMercadoLivrePromotions } from "@/lib/mercadolivre";

export async function fetchPromotions(): Promise<Promotion[]> {
  return fetchMercadoLivrePromotions();
}
