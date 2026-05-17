import { CartView } from './cart-view';

export const metadata = { title: 'Your bag' };

export default function CartPage() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 py-6 md:px-8 md:py-10">
      <h1 className="font-display text-[28px] font-semibold tracking-tight text-ink-900 md:text-[36px]">
        Your bag
      </h1>
      <CartView />
    </div>
  );
}
