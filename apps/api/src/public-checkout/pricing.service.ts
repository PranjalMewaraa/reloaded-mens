import { Injectable } from '@nestjs/common';
import { Prisma, prisma } from '@repo/db';

// Helper that resolves shipping + tax for a cart subtotal. GST stays inclusive per the
// architecture plan, so we back out the tax portion of each line from the line total
// (price × qty), giving us a single `taxPaisa` aggregate for the order summary.

export interface PriceLineInput {
  unitPricePaisa: number;
  quantity: number;
  gstRatePercent: number | null;
}

@Injectable()
export class PricingService {
  /**
   * Reads shipping config from the Settings table. Falls back to sane defaults if the
   * keys aren't present so the seed isn't a hard dependency.
   */
  async getShippingConfig(): Promise<{ flatFeePaisa: number; freeThresholdPaisa: number }> {
    const rows = await prisma.setting.findMany({
      where: { key: { in: ['shipping.flat_fee_paisa', 'shipping.free_threshold_paisa'] } },
    });
    const map = new Map<string, Prisma.JsonValue>(rows.map((r) => [r.key, r.value]));
    return {
      flatFeePaisa: toIntPaisa(map.get('shipping.flat_fee_paisa'), 9900),
      freeThresholdPaisa: toIntPaisa(map.get('shipping.free_threshold_paisa'), 199900),
    };
  }

  /**
   * Compute the shipping fee for a given subtotal, waiving it when the customer crosses
   * the free-shipping threshold. Result is in paisa.
   */
  computeShipping(subtotalPaisa: number, cfg: { flatFeePaisa: number; freeThresholdPaisa: number }): number {
    if (cfg.freeThresholdPaisa > 0 && subtotalPaisa >= cfg.freeThresholdPaisa) return 0;
    return cfg.flatFeePaisa;
  }

  /**
   * Back-calculate the tax portion of a single line. Prices in our catalogue are
   * already GST-inclusive (per architecture plan), so:
   *   net = total / (1 + rate)
   *   tax = total - net
   * We round per-line to keep aggregate tax stable.
   */
  computeLineTax(input: PriceLineInput): number {
    if (!input.gstRatePercent || input.gstRatePercent <= 0) return 0;
    const lineTotal = input.unitPricePaisa * input.quantity;
    const net = Math.round((lineTotal * 100) / (100 + input.gstRatePercent));
    return Math.max(0, lineTotal - net);
  }
}

function toIntPaisa(value: Prisma.JsonValue | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value === 'string') {
    const n = Number.parseInt(value, 10);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return fallback;
}
