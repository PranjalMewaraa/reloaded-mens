import { Injectable, Logger } from '@nestjs/common';
import { createWriteStream, mkdirSync } from 'node:fs';
import { join } from 'node:path';
// pdfkit ships as CJS; TypeScript's esModuleInterop handles the default import.
import PDFDocument from 'pdfkit';

export interface BillLineItem {
  name: string;
  variantLabel: string | null;
  quantity: number;
  pricePaisa: number;
  totalPaisa: number;
}

export interface BillData {
  orderNumber: string;
  date: Date;
  customerName: string | null;
  customerPhone: string;
  items: BillLineItem[];
  subtotalPaisa: number;
  discountPaisa: number;
  totalPaisa: number;
  couponCode: string | null;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  footerNote: string;
  gstin?: string | null;
}

function formatRupees(paisa: number): string {
  return `₹${(paisa / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(d: Date): string {
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

@Injectable()
export class BillGenerator {
  private readonly logger = new Logger('BillGenerator');

  /**
   * Generate a PDF bill and save it to storagePath/bills/<orderNumber>.pdf
   * Returns the relative path from the storage root: 'bills/<orderNumber>.pdf'
   */
  async generate(bill: BillData, storagePath: string): Promise<string> {
    const billsDir = join(storagePath, 'bills');
    mkdirSync(billsDir, { recursive: true });

    const fileName = `${bill.orderNumber}.pdf`;
    const filePath = join(billsDir, fileName);

    await this.renderPdf(bill, filePath);
    this.logger.log(`Bill PDF generated: ${filePath}`);

    return `bills/${fileName}`;
  }

  private renderPdf(bill: BillData, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: [226, 800], // 80mm thermal-receipt width (226pt ≈ 80mm)
        margins: { top: 12, left: 12, right: 12, bottom: 12 },
        autoFirstPage: true,
      });

      const stream = createWriteStream(filePath);
      doc.pipe(stream);

      const pageW = 226 - 24; // content width after margins

      // ── Header ──────────────────────────────────────────────────────
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .text(bill.storeName.toUpperCase(), 12, 12, { width: pageW, align: 'center' });

      doc
        .font('Helvetica')
        .fontSize(7)
        .text(bill.storeAddress, 12, doc.y + 2, { width: pageW, align: 'center' });

      doc.text(`Tel: ${bill.storePhone}`, 12, doc.y + 1, { width: pageW, align: 'center' });

      if (bill.gstin) {
        doc.text(`GSTIN: ${bill.gstin}`, 12, doc.y + 1, { width: pageW, align: 'center' });
      }

      // ── Divider ─────────────────────────────────────────────────────
      doc.moveDown(0.5);
      doc
        .moveTo(12, doc.y)
        .lineTo(12 + pageW, doc.y)
        .dash(2, { space: 2 })
        .stroke()
        .undash();

      // ── Bill meta ───────────────────────────────────────────────────
      doc.moveDown(0.4);
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('BILL / RECEIPT', 12, doc.y, { width: pageW, align: 'center' });

      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(7);
      doc.text(`Bill No: ${bill.orderNumber}`, 12, doc.y, { width: pageW });
      doc.text(`Date:    ${formatDate(bill.date)}`, 12, doc.y + 1, { width: pageW });
      doc.text(`Phone:   ${bill.customerPhone}`, 12, doc.y + 1, { width: pageW });
      if (bill.customerName) {
        doc.text(`Name:    ${bill.customerName}`, 12, doc.y + 1, { width: pageW });
      }

      // ── Divider ─────────────────────────────────────────────────────
      doc.moveDown(0.5);
      doc.moveTo(12, doc.y).lineTo(12 + pageW, doc.y).stroke();

      // ── Items header ─────────────────────────────────────────────────
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').fontSize(7);
      doc.text('Item', 12, doc.y, { width: pageW * 0.5 });
      doc.text('Qty', 12 + pageW * 0.5, doc.y - doc.currentLineHeight(), {
        width: pageW * 0.15,
        align: 'right',
      });
      doc.text('Price', 12 + pageW * 0.65, doc.y - doc.currentLineHeight(), {
        width: pageW * 0.15,
        align: 'right',
      });
      doc.text('Total', 12 + pageW * 0.8, doc.y - doc.currentLineHeight(), {
        width: pageW * 0.2,
        align: 'right',
      });

      doc.moveDown(0.2);
      doc.moveTo(12, doc.y).lineTo(12 + pageW, doc.y).stroke();

      // ── Items ────────────────────────────────────────────────────────
      doc.font('Helvetica').fontSize(7);
      for (const item of bill.items) {
        doc.moveDown(0.3);
        const yStart = doc.y;

        const label = item.variantLabel ? `${item.name}\n${item.variantLabel}` : item.name;
        doc.text(label, 12, yStart, { width: pageW * 0.48 });
        const rowH = doc.y - yStart;

        doc.text(String(item.quantity), 12 + pageW * 0.5, yStart, {
          width: pageW * 0.15,
          align: 'right',
        });
        doc.text(formatRupees(item.pricePaisa), 12 + pageW * 0.65, yStart, {
          width: pageW * 0.15,
          align: 'right',
        });
        doc.text(formatRupees(item.totalPaisa), 12 + pageW * 0.8, yStart, {
          width: pageW * 0.2,
          align: 'right',
        });

        if (rowH > doc.currentLineHeight()) {
          doc.y = yStart + rowH;
        }
      }

      // ── Divider ─────────────────────────────────────────────────────
      doc.moveDown(0.5);
      doc.moveTo(12, doc.y).lineTo(12 + pageW, doc.y).stroke();

      // ── Totals ───────────────────────────────────────────────────────
      const totalsLeft = 12 + pageW * 0.5;
      const totalsRight = 12;
      const totalsW = pageW * 0.5;

      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(7);

      doc.text('Subtotal', totalsRight, doc.y, { width: totalsW });
      doc.text(formatRupees(bill.subtotalPaisa), totalsLeft, doc.y - doc.currentLineHeight(), {
        width: totalsW,
        align: 'right',
      });

      if (bill.discountPaisa > 0) {
        doc.moveDown(0.3);
        const discLabel = bill.couponCode
          ? `Discount (${bill.couponCode})`
          : 'Discount';
        doc.text(discLabel, totalsRight, doc.y, { width: totalsW });
        doc.text(`-${formatRupees(bill.discountPaisa)}`, totalsLeft, doc.y - doc.currentLineHeight(), {
          width: totalsW,
          align: 'right',
        });
      }

      doc.moveDown(0.3);
      doc.moveTo(12, doc.y).lineTo(12 + pageW, doc.y).stroke();

      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').fontSize(9);
      doc.text('TOTAL', totalsRight, doc.y, { width: totalsW });
      doc.text(formatRupees(bill.totalPaisa), totalsLeft, doc.y - doc.currentLineHeight(), {
        width: totalsW,
        align: 'right',
      });

      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(7);
      doc.text('Paid via UPI', totalsRight, doc.y, { width: totalsW });
      doc.text(formatRupees(bill.totalPaisa), totalsLeft, doc.y - doc.currentLineHeight(), {
        width: totalsW,
        align: 'right',
      });

      // ── Footer ───────────────────────────────────────────────────────
      doc.moveDown(0.8);
      doc
        .moveTo(12, doc.y)
        .lineTo(12 + pageW, doc.y)
        .dash(2, { space: 2 })
        .stroke()
        .undash();

      doc.moveDown(0.5);
      doc
        .font('Helvetica')
        .fontSize(7)
        .text(bill.footerNote || 'Thank you for shopping with us!', 12, doc.y, {
          width: pageW,
          align: 'center',
        });

      doc.moveDown(0.3);
      doc.text('reloadedmens.in  |  @reloadedmensss', 12, doc.y, {
        width: pageW,
        align: 'center',
      });

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  }
}
