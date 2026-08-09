import Image from "next/image";
import { Promotion } from "@/types/promotion";

export default function PromotionCard({ promotion }: { promotion: Promotion }) {
  const {
    name,
    image,
    store,
    previousPrice,
    currentPrice,
    discountPercentage,
    coupon,
    productUrl,
  } = promotion;

  return (
    <div className="flex flex-col rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="relative mb-4 h-40 rounded bg-zinc-50 dark:bg-zinc-800">
        <Image
          src={image}
          alt={name}
          fill
          className="object-contain p-4"
          sizes="(max-width: 640px) 100vw, 240px"
        />
      </div>

      <span className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
        {store}
      </span>
      <h2 className="mb-2 line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        {name}
      </h2>

      <div className="mt-auto flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {previousPrice !== null && (
            <span className="text-xs text-zinc-400 line-through">
              R$ {previousPrice.toFixed(2)}
            </span>
          )}
          {discountPercentage !== null && discountPercentage > 0 && (
            <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900 dark:text-green-300">
              -{discountPercentage}%
            </span>
          )}
        </div>
        <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          R$ {currentPrice.toFixed(2)}
        </span>
        {coupon && (
          <span className="text-xs text-blue-600 dark:text-blue-400">
            Cupom: <strong>{coupon}</strong>
          </span>
        )}
      </div>

      <a
        href={productUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block rounded-full bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Ver promoção
      </a>
    </div>
  );
}
