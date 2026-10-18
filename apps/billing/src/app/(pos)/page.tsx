'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Tag,
  ChevronDown,
  X,
  Loader2,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import {
  searchProducts,
  createPosOrder,
  getPosSettings,
  applyCoupon,
  type PosProduct,
  type ProductVariant,
  type PosSettings,
  type CreatePosOrderResponse,
} from '@/lib/api';

interface CartItem {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  pricePaisa: number;
  quantity: number;
  imageUrl?: string;
  stock: number;
}

function formatRupees(paise: number) {
  return `₹${(paise / 100).toFixed(2)}`;
}

function formatRupeesShort(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

// ─── Product Search Panel ──────────────────────────────────────────────────

function ProductGrid({
  onAddToCart,
}: {
  onAddToCart: (item: Omit<CartItem, 'quantity'>) => void;
}) {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [variantOpen, setVariantOpen] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setProducts([]); return; }
    setLoading(true);
    try {
      const results = await searchProducts(q);
      setProducts(results);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(query), 350);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, doSearch]);

  function handleAdd(product: PosProduct, variant: ProductVariant) {
    onAddToCart({
      variantId: variant.id,
      productId: product.id,
      productName: product.name,
      variantLabel: `${variant.size} · ${variant.color}`,
      pricePaisa: variant.price,
      imageUrl: variant.imageUrl ?? product.imageUrl,
      stock: variant.stock,
    });
    setVariantOpen(null);
  }

  function handlePlusClick(product: PosProduct) {
    if (product.variants.length === 1) {
      handleAdd(product, product.variants[0]);
    } else {
      setVariantOpen(variantOpen === product.id ? null : product.id);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-4 border-b border-[#2a2a2a]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products by name, SKU…"
            className="w-full pl-9 pr-4 py-2.5 bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 animate-spin" />
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {!query.trim() && products.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-600">
            <Search className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">Search for products to add to cart</p>
          </div>
        )}
        {query.trim() && !loading && products.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-600">
            <p className="text-sm">No products found for &quot;{query}&quot;</p>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {products.map((product) => (
            <div key={product.id} className="relative">
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden hover:border-amber-500/40 transition-colors">
                {/* Image */}
                <div className="relative aspect-square bg-[#111]">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="200px"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-zinc-700 text-3xl font-bold">
                      {product.name.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="text-white text-sm font-medium leading-tight truncate">{product.name}</p>
                  <p className="text-zinc-500 text-xs mt-0.5 truncate">
                    {product.variants.length === 1
                      ? `${product.variants[0].size} · ${product.variants[0].color}`
                      : `${product.variants.length} variants`}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <div>
                      <span className="text-amber-400 font-semibold text-sm">
                        {product.variants.length === 1
                          ? formatRupeesShort(product.variants[0].price)
                          : `from ${formatRupeesShort(Math.min(...product.variants.map((v) => v.price)))}`}
                      </span>
                      <span className="text-zinc-600 text-xs ml-1.5">
                        {product.variants.length === 1
                          ? `${product.variants[0].stock} left`
                          : ''}
                      </span>
                    </div>
                    <button
                      onClick={() => handlePlusClick(product)}
                      className="w-8 h-8 bg-amber-500 hover:bg-amber-600 rounded-lg flex items-center justify-center transition-colors"
                    >
                      {product.variants.length > 1 ? (
                        <ChevronDown className="w-4 h-4 text-black" />
                      ) : (
                        <Plus className="w-4 h-4 text-black" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Variant dropdown */}
              {variantOpen === product.id && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-[#222] border border-[#333] rounded-xl z-30 shadow-xl overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-[#333]">
                    <span className="text-xs text-zinc-400 font-medium">Select Variant</span>
                    <button onClick={() => setVariantOpen(null)}>
                      <X className="w-3.5 h-3.5 text-zinc-500" />
                    </button>
                  </div>
                  {product.variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => handleAdd(product, v)}
                      disabled={v.stock === 0}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#2a2a2a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
                    >
                      <div>
                        <span className="text-white text-xs font-medium">
                          {v.size} · {v.color}
                        </span>
                        <span className="text-zinc-500 text-xs ml-2">
                          {v.stock > 0 ? `${v.stock} left` : 'Out of stock'}
                        </span>
                      </div>
                      <span className="text-amber-400 text-xs font-semibold">
                        {formatRupeesShort(v.price)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Cart Panel ──────────────────────────────────────────────────────────────

function CartPanel({
  cart,
  onIncrease,
  onDecrease,
  onRemove,
  onProceed,
}: {
  cart: CartItem[];
  onIncrease: (variantId: string) => void;
  onDecrease: (variantId: string) => void;
  onRemove: (variantId: string) => void;
  onProceed: (discount: number, coupon: string) => void;
}) {
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPaisa: number } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const subtotal = cart.reduce((s, i) => s + i.pricePaisa * i.quantity, 0);
  const discount = appliedCoupon?.discountPaisa ?? 0;
  const total = Math.max(0, subtotal - discount);

  async function handleApplyCoupon() {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    setCouponError(null);
    try {
      const res = await applyCoupon(couponInput.trim(), subtotal);
      if (res && res.discountPaisa > 0) {
        setAppliedCoupon({ code: couponInput.trim(), discountPaisa: res.discountPaisa });
        setCouponInput('');
      } else {
        setCouponError('Invalid or inapplicable coupon');
      }
    } catch {
      setCouponError('Failed to validate coupon');
    } finally {
      setCouponLoading(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponError(null);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#2a2a2a]">
        <h2 className="text-white font-semibold">Cart {cart.length > 0 && `(${cart.length})`}</h2>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {cart.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-600">
            <p className="text-sm">Cart is empty</p>
            <p className="text-xs mt-1">Search and add products</p>
          </div>
        )}
        {cart.map((item) => (
          <div
            key={item.variantId}
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 flex items-center gap-3"
          >
            {item.imageUrl && (
              <div className="w-10 h-10 relative flex-shrink-0 rounded-lg overflow-hidden bg-[#111]">
                <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" sizes="40px" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{item.productName}</p>
              <p className="text-zinc-500 text-xs truncate">{item.variantLabel}</p>
              <p className="text-amber-400 text-xs font-semibold mt-0.5">
                {formatRupeesShort(item.pricePaisa)}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => onDecrease(item.variantId)}
                className="w-7 h-7 rounded-lg bg-[#2a2a2a] hover:bg-[#333] flex items-center justify-center transition-colors"
              >
                <Minus className="w-3.5 h-3.5 text-white" />
              </button>
              <span className="text-white text-sm w-6 text-center font-medium">{item.quantity}</span>
              <button
                onClick={() => onIncrease(item.variantId)}
                disabled={item.quantity >= item.stock}
                className="w-7 h-7 rounded-lg bg-[#2a2a2a] hover:bg-[#333] disabled:opacity-40 flex items-center justify-center transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-white" />
              </button>
              <button
                onClick={() => onRemove(item.variantId)}
                className="w-7 h-7 rounded-lg bg-[#2a2a2a] hover:bg-red-900/60 ml-1 flex items-center justify-center transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-zinc-400" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Totals + Checkout */}
      {cart.length > 0 && (
        <div className="p-4 border-t border-[#2a2a2a] space-y-3">
          {/* Coupon */}
          {!appliedCoupon ? (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => { setCouponInput(e.target.value); setCouponError(null); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                    placeholder="Coupon code"
                    className="w-full pl-8 pr-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 text-sm"
                  />
                </div>
                <button
                  onClick={handleApplyCoupon}
                  disabled={couponLoading || !couponInput.trim()}
                  className="px-3 py-2 bg-[#2a2a2a] hover:bg-[#333] disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                >
                  {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                </button>
              </div>
              {couponError && <p className="text-red-400 text-xs">{couponError}</p>}
            </div>
          ) : (
            <div className="flex items-center justify-between px-3 py-2 bg-green-950/30 border border-green-800/40 rounded-lg">
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-green-400" />
                <span className="text-green-300 text-sm font-medium">{appliedCoupon.code}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-400 text-sm">-{formatRupeesShort(appliedCoupon.discountPaisa)}</span>
                <button onClick={removeCoupon}>
                  <X className="w-3.5 h-3.5 text-zinc-500 hover:text-red-400" />
                </button>
              </div>
            </div>
          )}

          {/* Lines */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-zinc-400">
              <span>Subtotal</span>
              <span>{formatRupees(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-400">
                <span>Discount</span>
                <span>-{formatRupees(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-white font-bold text-base pt-1 border-t border-[#2a2a2a]">
              <span>Total</span>
              <span className="text-amber-400 text-lg">{formatRupees(total)}</span>
            </div>
          </div>

          <button
            onClick={() => onProceed(discount, appliedCoupon?.code ?? '')}
            disabled={cart.length === 0}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold text-base rounded-xl transition-colors"
          >
            PROCEED TO BILL
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Customer Details Modal ────────────────────────────────────────────────

function CustomerModal({
  total,
  onGenerate,
  onClose,
}: {
  total: number;
  onGenerate: (phone: string, name: string, email: string) => void;
  onClose: () => void;
}) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = phone.replace(/\s/g, '');
    if (!/^\+91\d{10}$/.test(cleaned) && !/^\d{10}$/.test(cleaned)) {
      setError('Enter a valid phone number (+91XXXXXXXXXX or 10 digits)');
      return;
    }
    const normalized = cleaned.startsWith('+91') ? cleaned : `+91${cleaned}`;
    onGenerate(normalized, name, email);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
          <h2 className="text-white font-semibold text-lg">Customer Details</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="text-center mb-2">
            <p className="text-zinc-400 text-sm">Total amount</p>
            <p className="text-amber-400 text-3xl font-bold">{formatRupees(total)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Phone Number <span className="text-red-400">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setError(''); }}
              placeholder="+91XXXXXXXXXX"
              required
              className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
            {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer name"
              className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email (optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@email.com"
              className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-black font-bold text-base rounded-xl transition-colors"
          >
            GENERATE QR
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── UPI QR Modal ─────────────────────────────────────────────────────────

function UpiQrModal({
  total,
  settings,
  orderRef,
  onBack,
  onPaymentReceived,
  loading,
}: {
  total: number;
  settings: PosSettings;
  orderRef: string;
  onBack: () => void;
  onPaymentReceived: () => void;
  loading: boolean;
}) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const amountRupees = (total / 100).toFixed(2);

  useEffect(() => {
    const upiString = `upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent(settings.upiName)}&am=${amountRupees}&cu=INR&tn=${encodeURIComponent(orderRef)}`;
    QRCode.toDataURL(upiString, { width: 280, margin: 2, color: { dark: '#000000', light: '#FFFFFF' } })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [settings, amountRupees, orderRef]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="p-5 border-b border-[#2a2a2a] flex items-center gap-3">
          <button onClick={onBack} className="text-zinc-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-white font-semibold text-lg">Scan to Pay</h2>
        </div>

        <div className="p-6 flex flex-col items-center gap-4">
          <div className="text-center">
            <p className="text-zinc-400 text-sm">Amount</p>
            <p className="text-amber-400 text-4xl font-bold mt-1">₹{amountRupees}</p>
          </div>

          {qrDataUrl ? (
            <div className="bg-white p-3 rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="UPI QR Code" className="w-56 h-56" />
            </div>
          ) : (
            <div className="w-64 h-64 bg-[#111] rounded-xl flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
            </div>
          )}

          <div className="text-center">
            <p className="text-zinc-500 text-xs">UPI ID</p>
            <p className="text-white text-sm font-mono mt-0.5">{settings.upiId}</p>
          </div>

          <button
            onClick={onPaymentReceived}
            disabled={loading}
            className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold text-base rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                PAYMENT RECEIVED
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Success Modal ────────────────────────────────────────────────────────

function SuccessModal({
  result,
  phone,
  onNewSale,
}: {
  result: CreatePosOrderResponse;
  phone: string;
  onNewSale: () => void;
}) {
  const amountRupees = (result.totalPaisa / 100).toFixed(2);

  function openWhatsApp() {
    if (result.whatsappUrl) {
      window.open(result.whatsappUrl, '_blank');
    } else {
      const msg = encodeURIComponent(
        `Hi! Your order at Reloaded Mens has been confirmed.\nOrder: ${result.orderNumber}\nAmount: ₹${amountRupees}\nThank you for shopping with us! 🛍️`
      );
      const phoneDigits = phone.replace(/^\+91/, '');
      window.open(`https://wa.me/91${phoneDigits}?text=${msg}`, '_blank');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
          </div>

          <div>
            <h2 className="text-white text-2xl font-bold">Bill Generated!</h2>
            <p className="text-zinc-400 text-sm mt-1">Payment confirmed</p>
          </div>

          <div className="w-full bg-[#111] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Order</span>
              <span className="text-white font-mono font-semibold">{result.orderNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Amount Paid</span>
              <span className="text-amber-400 font-bold">₹{amountRupees}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Phone</span>
              <span className="text-white">{phone}</span>
            </div>
          </div>

          <div className="w-full space-y-2">
            <button
              onClick={openWhatsApp}
              className="w-full py-3.5 bg-green-700 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              📱 SEND ON WHATSAPP
            </button>
            <button
              onClick={onNewSale}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              🔄 NEW SALE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────

type Modal = 'customer' | 'qr' | 'success';

export default function PosPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [modal, setModal] = useState<Modal | null>(null);
  const [discount, setDiscount] = useState(0);
  const [couponCode, setCouponCode] = useState('');
  const [customer, setCustomer] = useState({ phone: '', name: '', email: '' });
  const [settings, setSettings] = useState<PosSettings>({ upiId: 'merchant@upi', upiName: 'Reloaded Mens' });
  const [orderResult, setOrderResult] = useState<CreatePosOrderResponse | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);

  const subtotal = cart.reduce((s, i) => s + i.pricePaisa * i.quantity, 0);
  const total = Math.max(0, subtotal - discount);

  useEffect(() => {
    getPosSettings().then(setSettings).catch(() => {});
  }, []);

  function addToCart(item: Omit<CartItem, 'quantity'>) {
    setCart((prev) => {
      const existing = prev.find((c) => c.variantId === item.variantId);
      if (existing) {
        if (existing.quantity >= existing.stock) return prev;
        return prev.map((c) =>
          c.variantId === item.variantId ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }

  function increase(variantId: string) {
    setCart((prev) =>
      prev.map((c) =>
        c.variantId === variantId && c.quantity < c.stock
          ? { ...c, quantity: c.quantity + 1 }
          : c
      )
    );
  }

  function decrease(variantId: string) {
    setCart((prev) => {
      const item = prev.find((c) => c.variantId === variantId);
      if (!item) return prev;
      if (item.quantity === 1) return prev.filter((c) => c.variantId !== variantId);
      return prev.map((c) =>
        c.variantId === variantId ? { ...c, quantity: c.quantity - 1 } : c
      );
    });
  }

  function remove(variantId: string) {
    setCart((prev) => prev.filter((c) => c.variantId !== variantId));
  }

  function handleProceed(disc: number, coupon: string) {
    setDiscount(disc);
    setCouponCode(coupon);
    setModal('customer');
  }

  function handleGenerateQr(phone: string, name: string, email: string) {
    setCustomer({ phone, name, email });
    setModal('qr');
  }

  async function handlePaymentReceived() {
    setOrderLoading(true);
    try {
      const result = await createPosOrder({
        customerPhone: customer.phone,
        customerName: customer.name || undefined,
        customerEmail: customer.email || undefined,
        items: cart.map((c) => ({
          variantId: c.variantId,
          quantity: c.quantity,
          pricePaisa: c.pricePaisa,
        })),
        totalPaisa: total,
        discountPaisa: discount > 0 ? discount : undefined,
        couponCode: couponCode || undefined,
      });
      setOrderResult(result);
      setModal('success');
    } catch (err) {
      alert(`Error creating order: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setOrderLoading(false);
    }
  }

  function handleNewSale() {
    setCart([]);
    setDiscount(0);
    setCouponCode('');
    setCustomer({ phone: '', name: '', email: '' });
    setOrderResult(null);
    setModal(null);
  }

  const orderRef = orderResult?.orderNumber ?? `REF-${Date.now()}`;

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Left: Products */}
      <div className="flex-1 flex flex-col border-r border-[#2a2a2a] overflow-hidden">
        <ProductGrid onAddToCart={addToCart} />
      </div>

      {/* Right: Cart */}
      <div className="w-80 xl:w-96 flex flex-col overflow-hidden bg-[#111]">
        <CartPanel
          cart={cart}
          onIncrease={increase}
          onDecrease={decrease}
          onRemove={remove}
          onProceed={handleProceed}
        />
      </div>

      {/* Modals */}
      {modal === 'customer' && (
        <CustomerModal
          total={total}
          onGenerate={handleGenerateQr}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'qr' && (
        <UpiQrModal
          total={total}
          settings={settings}
          orderRef={orderRef}
          onBack={() => setModal('customer')}
          onPaymentReceived={handlePaymentReceived}
          loading={orderLoading}
        />
      )}
      {modal === 'success' && orderResult && (
        <SuccessModal
          result={orderResult}
          phone={customer.phone}
          onNewSale={handleNewSale}
        />
      )}
    </div>
  );
}
