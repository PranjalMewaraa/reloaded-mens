import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

export interface TotpSetup {
  secretBase32: string;
  otpauthUri: string;
  qrDataUrl: string;
}

@Injectable()
export class TotpService {
  private readonly issuer: string;

  constructor(config: ConfigService) {
    this.issuer = config.get<string>('ADMIN_TOTP_ISSUER') ?? 'Menswear Admin';
    // RFC 6238 defaults: SHA1, 6 digits, 30s step. otplib already uses these — explicit for clarity.
    authenticator.options = { digits: 6, step: 30, window: 1 };
  }

  // Generate a fresh secret + matching otpauth URI + a data-URL QR code for the admin app to render.
  async setup(accountLabel: string): Promise<TotpSetup> {
    const secretBase32 = authenticator.generateSecret();
    const otpauthUri = authenticator.keyuri(accountLabel, this.issuer, secretBase32);
    const qrDataUrl = await QRCode.toDataURL(otpauthUri, { margin: 1, width: 256 });
    return { secretBase32, otpauthUri, qrDataUrl };
  }

  verify(code: string, secretBase32: string): boolean {
    try {
      return authenticator.verify({ token: code, secret: secretBase32 });
    } catch {
      return false;
    }
  }
}
