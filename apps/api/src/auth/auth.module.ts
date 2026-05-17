import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { TotpService } from './totp.service.js';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy.js';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy.js';
import { StageStrategy } from './strategies/stage.strategy.js';
import { RolesGuard } from './guards/roles.guard.js';

// JwtService is provided per-secret inside AuthService.sign*() — we register the module
// without a static config so each token type can use its own secret + TTL.
@Module({
  imports: [ConfigModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    TotpService,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    StageStrategy,
    RolesGuard,
  ],
  exports: [AuthService, RolesGuard],
})
export class AuthModule {}
