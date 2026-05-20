import { Controller, Get, Header, Query, Res, UseGuards } from '@nestjs/common';
import { ADMIN_ROLE, reportRangeQuerySchema, type ReportRangeQuery } from '@repo/types';
import type { Response } from 'express';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ReportsService } from './reports.service.js';

// Default window when from/to aren't supplied: last 30 days, inclusive.
const DEFAULT_RANGE_DAYS = 30;

function resolveRange(input: ReportRangeQuery): { from: Date; to: Date } {
  const to = input.to ? new Date(input.to) : new Date();
  const from = input.from
    ? new Date(input.from)
    : new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
  return { from, to };
}

// Escape one CSV field per RFC 4180 — quote-wrap, double up any internal quotes.
function csvField(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function csvRow(values: unknown[]): string {
  return values.map(csvField).join(',');
}

@Controller('admin-reports')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(ADMIN_ROLE.ADMIN, ADMIN_ROLE.STAFF)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  async summary(@Query(new ZodValidationPipe(reportRangeQuerySchema)) q: ReportRangeQuery) {
    const { from, to } = resolveRange(q);
    return this.reports.summary(from, to);
  }

  @Get('sales-by-day')
  async salesByDay(@Query(new ZodValidationPipe(reportRangeQuerySchema)) q: ReportRangeQuery) {
    const { from, to } = resolveRange(q);
    return this.reports.salesByDay(from, to);
  }

  @Get('top-products')
  async topProducts(
    @Query(new ZodValidationPipe(reportRangeQuerySchema)) q: ReportRangeQuery,
    @Query('limit') limitRaw?: string,
  ) {
    const { from, to } = resolveRange(q);
    const limit = Math.min(50, Math.max(1, Number(limitRaw) || 10));
    return this.reports.topProducts(from, to, limit);
  }

  @Get('top-customers')
  async topCustomers(
    @Query(new ZodValidationPipe(reportRangeQuerySchema)) q: ReportRangeQuery,
    @Query('limit') limitRaw?: string,
  ) {
    const { from, to } = resolveRange(q);
    const limit = Math.min(50, Math.max(1, Number(limitRaw) || 10));
    return this.reports.topCustomers(from, to, limit);
  }

  // CSV export — streams a Content-Disposition: attachment so the browser
  // shows a download prompt. One endpoint with a `type` query param to keep
  // the surface small (one CSV-shape handler instead of four).
  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @Query(new ZodValidationPipe(reportRangeQuerySchema)) q: ReportRangeQuery,
    @Query('type') type: string,
    @Res() res: Response,
  ) {
    const { from, to } = resolveRange(q);
    const fromTag = from.toISOString().slice(0, 10);
    const toTag = to.toISOString().slice(0, 10);

    if (type === 'sales-by-day') {
      const { items } = await this.reports.salesByDay(from, to);
      const lines: string[] = [csvRow(['date', 'revenue_paisa', 'order_count'])];
      for (const r of items) lines.push(csvRow([r.date, r.revenuePaisa, r.orderCount]));
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="sales-by-day-${fromTag}-to-${toTag}.csv"`,
      );
      return res.send(lines.join('\n'));
    }

    if (type === 'top-products') {
      const { items } = await this.reports.topProducts(from, to, 50);
      const lines: string[] = [
        csvRow(['product_id', 'product_name', 'product_slug', 'units_sold', 'revenue_paisa']),
      ];
      for (const r of items)
        lines.push(csvRow([r.productId, r.productName, r.productSlug, r.unitsSold, r.revenuePaisa]));
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="top-products-${fromTag}-to-${toTag}.csv"`,
      );
      return res.send(lines.join('\n'));
    }

    if (type === 'top-customers') {
      const { items } = await this.reports.topCustomers(from, to, 50);
      const lines: string[] = [
        csvRow(['customer_id', 'name', 'phone', 'email', 'order_count', 'total_spent_paisa']),
      ];
      for (const r of items)
        lines.push(csvRow([r.customerId, r.name ?? '', r.phone, r.email ?? '', r.orderCount, r.totalSpentPaisa]));
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="top-customers-${fromTag}-to-${toTag}.csv"`,
      );
      return res.send(lines.join('\n'));
    }

    res.status(400).send('Unknown export type. Try sales-by-day | top-products | top-customers.');
  }
}
