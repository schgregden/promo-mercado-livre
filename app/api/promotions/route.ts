import { NextResponse } from "next/server";
import { fetchPromotions } from "@/lib/promotions";

export async function GET() {
  try {
    const promotions = await fetchPromotions();
    return NextResponse.json(promotions);
  } catch (error) {
    console.error("Falha ao buscar promoções do Mercado Livre:", error);
    return NextResponse.json(
      { message: "Não foi possível carregar as promoções do Mercado Livre." },
      { status: 502 }
    );
  }
}
