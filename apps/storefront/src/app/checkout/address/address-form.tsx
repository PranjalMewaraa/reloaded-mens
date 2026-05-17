'use client';

// Step 1 — contact + shipping address. react-hook-form + zod for inline validation.
// Pre-fills pincode from PincodeProvider if the customer set one earlier; pre-fills the
// address from sessionStorage if they're returning to this step via back-button.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { contactInfoSchema, shippingAddressSchema, type ShippingAddress } from '@repo/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCart } from '@/lib/cart-context';
import { usePincode } from '@/lib/pincode-context';
import { cn } from '@/lib/utils';
import { readAddress, readContact, writeAddress, writeContact } from '../checkout-storage';

const formSchema = z.object({
  name: contactInfoSchema.shape.name,
  phone: contactInfoSchema.shape.phone,
  email: z.string().email().optional().or(z.literal('').transform(() => undefined)),
  line1: shippingAddressSchema.shape.line1,
  line2: shippingAddressSchema.shape.line2,
  city: shippingAddressSchema.shape.city,
  state: shippingAddressSchema.shape.state,
  pincode: shippingAddressSchema.shape.pincode,
});

type FormValues = z.infer<typeof formSchema>;

// Indian states / UTs in alphabetical order. Kept inline because we don't ship a separate
// constants module yet and this list is stable.
const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
  'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal',
];

export function AddressForm() {
  const router = useRouter();
  const { items, hydrated } = useCart();
  const { pincode } = usePincode();

  // Bounce to /cart if the cart is empty. The check has to wait for hydration.
  React.useEffect(() => {
    if (hydrated && items.length === 0) router.replace('/cart');
  }, [hydrated, items.length, router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      phone: '+91',
      email: '',
      line1: '',
      line2: '',
      city: '',
      state: 'Karnataka',
      pincode: pincode ?? '',
    },
  });

  // Re-hydrate from sessionStorage on mount.
  React.useEffect(() => {
    const stored = readAddress();
    const contact = readContact();
    if (stored) {
      setValue('line1', stored.line1);
      setValue('line2', stored.line2 ?? '');
      setValue('city', stored.city);
      setValue('state', stored.state);
      setValue('pincode', stored.pincode);
    }
    if (contact) {
      setValue('name', contact.name);
      setValue('phone', contact.phone);
      setValue('email', contact.email ?? '');
    }
    if (!stored && pincode) {
      setValue('pincode', pincode);
    }
  }, [pincode, setValue]);

  function onSubmit(values: FormValues) {
    const address: ShippingAddress = {
      name: values.name,
      phone: values.phone,
      line1: values.line1,
      line2: values.line2 || undefined,
      city: values.city,
      state: values.state,
      pincode: values.pincode,
      country: 'IN',
    };
    writeAddress(address);
    writeContact({
      name: values.name,
      phone: values.phone,
      email: values.email || undefined,
    });
    router.push('/checkout/shipping');
  }

  if (!hydrated) return null;
  if (items.length === 0) return null;

  return (
    <form className="grid grid-cols-1 gap-6 lg:grid-cols-[7fr_5fr]" onSubmit={handleSubmit(onSubmit)}>
      <section className="space-y-5">
        <div className="rounded-2xl border border-ink-100 bg-snow p-5">
          <h2 className="font-display text-[18px] font-semibold text-ink-900">Contact</h2>
          <p className="mt-1 text-[12px] text-ink-500">We&apos;ll WhatsApp + email order updates here.</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Full name" error={errors.name?.message}>
              <Input {...register('name')} aria-invalid={Boolean(errors.name)} autoComplete="name" />
            </Field>
            <Field label="Phone" error={errors.phone?.message} hint="WhatsApp number with country code">
              <Input
                {...register('phone')}
                aria-invalid={Boolean(errors.phone)}
                inputMode="tel"
                placeholder="+919999999999"
                autoComplete="tel"
              />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Email (optional)" error={errors.email?.message}>
              <Input
                {...register('email')}
                aria-invalid={Boolean(errors.email)}
                type="email"
                autoComplete="email"
              />
            </Field>
          </div>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-snow p-5">
          <h2 className="font-display text-[18px] font-semibold text-ink-900">Shipping address</h2>
          <div className="mt-4 grid grid-cols-1 gap-3">
            <Field label="House / flat number" error={errors.line1?.message}>
              <Input {...register('line1')} aria-invalid={Boolean(errors.line1)} autoComplete="address-line1" />
            </Field>
            <Field label="Locality (optional)" error={errors.line2?.message}>
              <Input {...register('line2')} autoComplete="address-line2" />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="City" error={errors.city?.message}>
                <Input {...register('city')} aria-invalid={Boolean(errors.city)} autoComplete="address-level2" />
              </Field>
              <Field label="State" error={errors.state?.message}>
                <select
                  {...register('state')}
                  className="flex h-12 w-full rounded-md border border-ink-200 bg-snow px-3.5 text-[14px] text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900"
                >
                  {STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Pincode" error={errors.pincode?.message}>
              <Input
                {...register('pincode')}
                aria-invalid={Boolean(errors.pincode)}
                inputMode="numeric"
                maxLength={6}
                autoComplete="postal-code"
              />
            </Field>
          </div>
        </div>
      </section>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border border-ink-100 bg-snow p-4">
          <h3 className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">Bag summary</h3>
          <ul className="mt-2 flex flex-col gap-1.5 text-[12.5px] text-ink-700">
            {items.map((item) => (
              <li key={item.variantId} className="flex justify-between gap-2">
                <span className="truncate">
                  {item.productName} × {item.quantity}
                </span>
                <span className="font-mono">{(item.unitPricePaisa * item.quantity / 100).toLocaleString('en-IN')}</span>
              </li>
            ))}
          </ul>
        </div>
        <Button type="submit" size="lg" className="mt-3 w-full" disabled={isSubmitting}>
          Continue to shipping
        </Button>
      </aside>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={cn('mb-1 block font-mono text-[10.5px] uppercase tracking-caps text-ink-500')}>
        {label}
      </span>
      {children}
      {error ? <span className="mt-1 block text-[12px] text-danger">{error}</span> : null}
      {hint && !error ? <span className="mt-1 block text-[11px] text-ink-500">{hint}</span> : null}
    </label>
  );
}
