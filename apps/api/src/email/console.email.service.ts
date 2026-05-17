import { Injectable, Logger } from '@nestjs/common';
import { render } from '@react-email/render';
import { ConfigService } from '@nestjs/config';
import * as React from 'react';
import type { OrderSnapshot } from '@repo/types';
import type { EmailService } from './email.types.js';
import { OrderConfirmationEmail } from './templates/order-confirmation.js';

// Fallback transport — logs the rendered email subject + a one-line summary to stdout
// when RESEND_API_KEY is unset. Sprint 4 acceptance can run without a Resend account.
@Injectable()
export class ConsoleEmailService implements EmailService {
  private readonly logger = new Logger('Email/Console');

  constructor(private readonly config: ConfigService) {}

  async sendOrderConfirmation({ to, order }: { to: string; order: OrderSnapshot }): Promise<void> {
    const brandName = this.config.get<string>('EMAIL_FROM_NAME') ?? 'Reloaded';
    const storefrontUrl =
      this.config.get<string>('NEXT_PUBLIC_STOREFRONT_URL') ?? 'http://localhost:3000';
    const whatsappNumber =
      this.config.get<string>('NEXT_PUBLIC_WHATSAPP_NUMBER') ??
      this.config.get<string>('business.whatsapp_number') ??
      '+919999999999';

    const html = await render(
      React.createElement(OrderConfirmationEmail, {
        order,
        brandName,
        storefrontUrl,
        whatsappNumber,
      }),
    );

    this.logger.log(
      `[order-confirmation] to=${to} subject="Order ${order.orderNumber} confirmed · ${brandName}" ` +
        `total=₹${(order.totalPaisa / 100).toFixed(2)} html_bytes=${html.length}`,
    );
  }
}
