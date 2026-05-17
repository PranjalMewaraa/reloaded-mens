import type { ShippingProvider as ShippingProviderId, OrderSnapshot } from '@repo/types';

// Sprint 5 shipping provider abstraction. Two impls: MockShippingProvider (returns
// fake AWBs, renders printable HTML labels) and ShiprocketShippingProvider (Sprint 11
// stub). Swap via SHIPPING_PROVIDER env.

export interface AssignAwbInput {
  orderId: string;
  orderNumber: string;
}

export interface AssignAwbResult {
  trackingNumber: string;
}

export interface RenderLabelInput {
  // Use the existing OrderSnapshot shape from @repo/types so callers can pass the
  // result of public-checkout.getOrderByNumber() straight through.
  order: OrderSnapshot & {
    trackingNumber?: string | null;
  };
}

export interface ShippingProviderImpl {
  readonly name: ShippingProviderId;
  assignAwb(input: AssignAwbInput): Promise<AssignAwbResult>;
  renderLabelHtml(input: RenderLabelInput): Promise<string>;
}

export const SHIPPING_PROVIDER_TOKEN = 'SHIPPING_PROVIDER';
