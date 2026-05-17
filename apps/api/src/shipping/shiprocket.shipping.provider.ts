import { Injectable, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SHIPPING_PROVIDER } from '@repo/types';
import type {
  AssignAwbInput,
  AssignAwbResult,
  RenderLabelInput,
  ShippingProviderImpl,
} from './shipping.types.js';

// Placeholder for Sprint 11. Constructor reads expected env so misconfigured deploys
// surface "set me up" errors at boot.
@Injectable()
export class ShiprocketShippingProvider implements ShippingProviderImpl {
  readonly name = SHIPPING_PROVIDER.SHIPROCKET;

  constructor(config: ConfigService) {
    void config.get<string>('SHIPROCKET_EMAIL');
    void config.get<string>('SHIPROCKET_PASSWORD');
  }

  assignAwb(_input: AssignAwbInput): Promise<AssignAwbResult> {
    return Promise.reject(
      new NotImplementedException(
        'Shiprocket shipping provider not configured. Set SHIPPING_PROVIDER=mock or wire the SDK + creds.',
      ),
    );
  }

  renderLabelHtml(_input: RenderLabelInput): Promise<string> {
    return Promise.reject(
      new NotImplementedException(
        'Shiprocket label rendering not implemented. Sprint 11 ships the AWB PDF.',
      ),
    );
  }
}
