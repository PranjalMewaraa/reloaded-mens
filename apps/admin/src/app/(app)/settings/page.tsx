import { api } from '@/lib/api';
import { UpiSettingsForm } from './upi-settings-form';

export const metadata = { title: 'Settings' };

interface UpiSlot {
  upiId: string;
  label: string;
}

interface PosUpiResponse {
  slots: UpiSlot[];
  activeIndex: number;
}

export default async function SettingsPage() {
  const res = await api<PosUpiResponse>('/admin/settings/pos-upi', { forwardCookies: true });
  const data: PosUpiResponse = res.ok && res.body
    ? res.body
    : { slots: [], activeIndex: 0 };

  return (
    <div className="mx-auto max-w-[720px] space-y-8 px-5 py-6 md:px-8 md:py-8">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-ink-900">Settings</h1>
        <p className="mt-1 text-[13px] text-ink-500">Manage POS configuration for the billing app.</p>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink-900">UPI IDs for POS</h2>
          <p className="mt-0.5 text-[13px] text-ink-500">
            Add up to 3 UPI IDs. The biller can switch between them live on the POS screen.
          </p>
        </div>
        <UpiSettingsForm initialSlots={data.slots} initialActiveIndex={data.activeIndex} />
      </section>
    </div>
  );
}
