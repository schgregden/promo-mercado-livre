"use client";

import { useState } from "react";
import { Promotion } from "@/types/promotion";
import PromotionCard from "@/components/PromotionCard";

export default function PromotionsView({
  initialPromotions,
  initialError,
}: {
  initialPromotions: Promotion[];
  initialError: string | null;
}) {
  const [promotions, setPromotions] = useState<Promotion[]>(initialPromotions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      // Rota interna: a chamada autenticada à API do Mercado Livre acontece
      // no servidor. O cliente nunca lida com client_secret ou tokens.
      const response = await fetch("/api/promotions", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const data: Promotion[] = await response.json();
      setPromotions(data);
    } catch {
      setError("Não foi possível carregar as promoções do Mercado Livre.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex-1 bg-zinc-50 dark:bg-black">
      <header className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Catálogo de Promoções
        </h1>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? "Atualizando..." : "Atualizar promoções"}
        </button>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          {loading
            ? "Buscando promoções..."
            : `${promotions.length} promoções encontradas`}
        </p>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {promotions.map((promotion) => (
            <PromotionCard key={promotion.id} promotion={promotion} />
          ))}
        </div>
      </main>
    </div>
  );
}
