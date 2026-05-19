import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { SHIPPING_PROVIDER } from '@repo/types';
import type {
  AssignAwbInput,
  AssignAwbResult,
  RenderLabelInput,
  ShippingProviderImpl,
} from './shipping.types.js';

// Generates synthetic AWBs and prints a self-contained HTML label the admin can save
// as PDF via the browser. No external API. Sprint 11 will replace this with a real
// Shiprocket integration.
@Injectable()
export class MockShippingProvider implements ShippingProviderImpl {
  readonly name = SHIPPING_PROVIDER.MOCK;

  async assignAwb(_input: AssignAwbInput): Promise<AssignAwbResult> {
    // 6 hex chars = ~16M space — collisions on a dev DB are astronomically unlikely,
    // and the trackingNumber is also indexed @unique-ish via the order.
    const suffix = randomBytes(3).toString('hex').toUpperCase();
    return { trackingNumber: `MOCK-AWB-${suffix}` };
  }

  async renderLabelHtml(input: RenderLabelInput): Promise<string> {
    const { order } = input;
    const itemsHtml = order.items
      .map(
        (item) => `
        <tr>
          <td>${escape(item.productName)}</td>
          <td class="mono">${escape(item.sku)}</td>
          <td class="mono">${item.quantity}</td>
        </tr>`,
      )
      .join('');

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Shipping label · ${escape(order.orderNumber)}</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
        margin: 0;
        background: #ffffff;
        color: #0a0a0a;
        padding: 24px;
      }
      .label {
        border: 2px solid #0a0a0a;
        border-radius: 8px;
        max-width: 480px;
        margin: 0 auto;
        padding: 20px 24px;
      }
      .brand {
        font-family: 'Fraunces', Georgia, serif;
        font-weight: 600;
        font-size: 22px;
        letter-spacing: -0.01em;
      }
      .caps {
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: #71717a;
      }
      .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
      h1.order {
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 24px;
        margin: 4px 0 18px;
      }
      .address {
        border: 1px dashed #a1a1aa;
        border-radius: 6px;
        padding: 12px 14px;
        margin: 0 0 16px;
        font-size: 14px;
        line-height: 1.55;
      }
      .tracking {
        background: #0a0a0a;
        color: #ffffff;
        text-align: center;
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 16px;
        padding: 10px 12px;
        border-radius: 4px;
        margin: 0 0 16px;
        letter-spacing: 0.12em;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e4e4e7; }
      th { font-family: 'JetBrains Mono', ui-monospace, monospace; text-transform: uppercase; font-size: 9px; letter-spacing: 0.18em; color: #71717a; }
      .footer {
        margin-top: 18px;
        font-size: 11px;
        color: #52525b;
        line-height: 1.5;
      }
      @media print {
        body { padding: 0; }
        .label { border: 1.5px solid #0a0a0a; box-shadow: none; }
      }
    </style>
  </head>
  <body>
    <div class="label">
      <div class="brand">Reloaded.</div>
      <div class="caps">Order number</div>
      <h1 class="order">${escape(order.orderNumber)}</h1>
      <div class="caps">Ship to</div>
      <div class="address">
        ${escape(order.shippingAddress.name)}<br />
        ${escape(order.shippingAddress.line1)}${order.shippingAddress.line2 ? `, ${escape(order.shippingAddress.line2)}` : ''}<br />
        ${escape(order.shippingAddress.city)}, ${escape(order.shippingAddress.state)}
        <span class="mono">${escape(order.shippingAddress.pincode)}</span><br />
        <span class="mono">${escape(order.shippingAddress.phone)}</span>
      </div>
      ${order.trackingNumber ? `<div class="tracking">${escape(order.trackingNumber)}</div>` : ''}
      <table>
        <thead>
          <tr><th>Item</th><th>SKU</th><th>Qty</th></tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      <p class="footer">
        From Reloaded · Ghaziabad. Returns within 14 days — see reloaded.example/returns.
        Please ensure outer packaging is intact upon delivery.
      </p>
    </div>
    <script>window.print && window.addEventListener('load', () => setTimeout(() => window.print(), 250));</script>
  </body>
</html>`;
  }
}

// Tiny HTML-escape — keeps user-supplied address strings from breaking the label.
function escape(value: string | null | undefined): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
