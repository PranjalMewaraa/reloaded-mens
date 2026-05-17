import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { render } from '@react-email/render';
import { Resend } from 'resend';
import * as React from 'react';
import type { OrderSnapshot } from '@repo/types';
import type { EmailService } from './email.types.js';
import { OrderConfirmationEmail } from './templates/order-confirmation.js';

// Real transactional transport using Resend. Selected by the email module's factory when
// RESEND_API_KEY is present; otherwise the console service is wired instead. Failures
// log + swallow — order confirmation is best-effort; the order has already been written.
@Injectable()
export class ResendEmailService implements EmailService {
  private readonly logger = new Logger('Email/Resend');
  private readonly resend: Resend;
  private readonly from: string;
  private readonly brandName: string;
  private readonly storefrontUrl: string;
  private readonly whatsappNumber: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      throw new Error('ResendEmailService instantiated without RESEND_API_KEY');
    }
    this.resend = new Resend(apiKey);
    const fromEmail = config.get<string>('EMAIL_FROM') ?? 'orders@example.com';
    const fromName = config.get<string>('EMAIL_FROM_NAME') ?? 'Reloaded';
    this.from = `${fromName} <${fromEmail}>`;
    this.brandName = fromName;
    this.storefrontUrl =
      config.get<string>('NEXT_PUBLIC_STOREFRONT_URL') ?? 'http://localhost:3000';
    this.whatsappNumber =
      config.get<string>('NEXT_PUBLIC_WHATSAPP_NUMBER') ?? '+919999999999';
  }

  async sendOrderConfirmation({ to, order }: { to: string; order: OrderSnapshot }): Promise<void> {
    try {
      const html = await render(
        React.createElement(OrderConfirmationEmail, {
          order,
          brandName: this.brandName,
          storefrontUrl: this.storefrontUrl,
          whatsappNumber: this.whatsappNumber,
        }),
      );
      const subject = `Order ${order.orderNumber} confirmed · ${this.brandName}`;
      const { error } = await this.resend.emails.send({
        from: this.from,
        to,
        subject,
        html,
      });
      if (error) {
        this.logger.error(`Resend rejected the email: ${error.message ?? JSON.stringify(error)}`);
      }
    } catch (err) {
      this.logger.error(`sendOrderConfirmation failed: ${(err as Error).message}`);
    }
  }
}
