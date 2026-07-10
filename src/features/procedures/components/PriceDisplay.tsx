import { formatCurrency, calculateDiscount, type DiscountType } from "../types";

interface PriceDisplayProps {
  basePrice: number;
  discountType?: DiscountType | null;
  discountValue?: number;
  showLabel?: boolean;
}

/**
 * Displays procedure price with optional discount visualization.
 * When discount is applied, shows original price strikethrough + final price.
 * Used in appointment/billing contexts where discounts are applied per-procedure.
 */
export default function PriceDisplay({
  basePrice,
  discountType,
  discountValue,
  showLabel = false,
}: PriceDisplayProps) {
  const hasDiscount = discountType && discountValue && discountValue > 0;

  if (!hasDiscount) {
    return (
      <div className="flex items-center gap-2">
        {showLabel && <span className="text-xs text-gray-500">Precio:</span>}
        <span className="font-semibold text-gray-900">{formatCurrency(basePrice)}</span>
      </div>
    );
  }

  const finalPrice = calculateDiscount(basePrice, discountType, discountValue);
  const discountLabel =
    discountType === "percentage" ? `${discountValue}%` : formatCurrency(discountValue);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        {showLabel && <span className="text-xs text-gray-500">Precio:</span>}
        <span className="text-sm text-gray-400 line-through">{formatCurrency(basePrice)}</span>
        <span className="font-semibold text-green-700">{formatCurrency(finalPrice)}</span>
      </div>
      <span className="text-xs text-green-600">-{discountLabel} descuento</span>
    </div>
  );
}
