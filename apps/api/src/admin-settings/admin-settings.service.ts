import { BadRequestException, Injectable } from '@nestjs/common';
import { prisma } from '@repo/db';
import { z } from 'zod';

const upiSlotSchema = z.object({
  upiId: z.string().min(1),
  label: z.string().min(1),
});

const updatePosUpiSchema = z.object({
  slots: z.array(upiSlotSchema).min(1).max(3),
  activeIndex: z.number().int().min(0).max(2),
});

export type UpiSlot = z.infer<typeof upiSlotSchema>;

@Injectable()
export class AdminSettingsService {
  async getPosUpi(): Promise<{ slots: UpiSlot[]; activeIndex: number }> {
    const rows = await prisma.setting.findMany({
      where: { key: { in: ['pos.upi_slots', 'pos.upi_active'] } },
    });
    const get = (k: string) => rows.find((r) => r.key === k)?.value as string | null ?? null;

    let slots: UpiSlot[] = [];
    try {
      const raw = get('pos.upi_slots');
      if (raw) slots = JSON.parse(raw) as UpiSlot[];
    } catch { /* ignore */ }

    // Backfill from legacy pos.upi_id if no slots stored yet
    if (slots.length === 0) {
      const legacyId = (await prisma.setting.findUnique({ where: { key: 'pos.upi_id' } }))?.value as string | null;
      if (legacyId) slots = [{ upiId: legacyId, label: 'Primary' }];
    }

    const activeIndex = Math.min(parseInt(get('pos.upi_active') ?? '0', 10) || 0, Math.max(slots.length - 1, 0));
    return { slots, activeIndex };
  }

  async updatePosUpi(body: unknown): Promise<{ slots: UpiSlot[]; activeIndex: number }> {
    const parsed = updatePosUpiSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const { slots, activeIndex } = parsed.data;
    if (activeIndex >= slots.length) {
      throw new BadRequestException('activeIndex out of range');
    }

    await prisma.$transaction([
      prisma.setting.upsert({
        where: { key: 'pos.upi_slots' },
        update: { value: JSON.stringify(slots) },
        create: { key: 'pos.upi_slots', value: JSON.stringify(slots) },
      }),
      prisma.setting.upsert({
        where: { key: 'pos.upi_active' },
        update: { value: String(activeIndex) },
        create: { key: 'pos.upi_active', value: String(activeIndex) },
      }),
      // Keep legacy key in sync so existing code still works
      prisma.setting.upsert({
        where: { key: 'pos.upi_id' },
        update: { value: slots[activeIndex].upiId },
        create: { key: 'pos.upi_id', value: slots[activeIndex].upiId },
      }),
    ]);

    return { slots, activeIndex };
  }

  async switchUpiActive(index: number): Promise<{ activeIndex: number }> {
    const { slots } = await this.getPosUpi();
    if (index < 0 || index >= slots.length) {
      throw new BadRequestException('Invalid UPI slot index');
    }
    await prisma.$transaction([
      prisma.setting.upsert({
        where: { key: 'pos.upi_active' },
        update: { value: String(index) },
        create: { key: 'pos.upi_active', value: String(index) },
      }),
      prisma.setting.upsert({
        where: { key: 'pos.upi_id' },
        update: { value: slots[index].upiId },
        create: { key: 'pos.upi_id', value: slots[index].upiId },
      }),
    ]);
    return { activeIndex: index };
  }
}
