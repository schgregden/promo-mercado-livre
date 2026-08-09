export interface Promotion {
  id: string;
  name: string;
  image: string;
  currentPrice: number;
  previousPrice: number | null;
  discountPercentage: number | null;
  store: string;
  productUrl: string;
  coupon: string | null;
}
