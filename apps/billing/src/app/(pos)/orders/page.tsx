import { Receipt, MessageCircle, Calendar, Package } from 'lucide-react';
import { getPosOrders, type PosOrder } from '@/lib/api';

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRupees(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

function OrdersFilter({ current }: { current: string }) {
  const filters = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'all', label: 'All' },
  ];

  return (
    <div className="flex gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-1">
      {filters.map((f) => (
        <a
          key={f.value}
          href={`/orders?filter=${f.value}`}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            current === f.value
              ? 'bg-amber-500 text-black'
              : 'text-zinc-400 hover:text-white hover:bg-[#2a2a2a]'
          }`}
        >
          {f.label}
        </a>
      ))}
    </div>
  );
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = 'today' } = await searchParams;
  let orders: PosOrder[] = [];
  let fetchError = false;

  try {
    orders = await getPosOrders(filter);
  } catch {
    fetchError = true;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">POS Orders</h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            {orders.length} order{orders.length !== 1 ? 's' : ''}
          </p>
        </div>
        <OrdersFilter current={filter} />
      </div>

      {fetchError && (
        <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-4 mb-4 text-red-400 text-sm">
          Failed to load orders. The API may be unavailable.
        </div>
      )}

      {orders.length === 0 && !fetchError ? (
        <div className="flex flex-col items-center justify-center h-64 text-zinc-600">
          <Receipt className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-base">No orders found</p>
          <p className="text-sm mt-1">Orders you create will appear here</p>
        </div>
      ) : (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left px-4 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider">
                    Order
                  </th>
                  <th className="text-left px-4 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="text-left px-4 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider hidden md:table-cell">
                    Items
                  </th>
                  <th className="text-right px-4 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider">
                    Total
                  </th>
                  <th className="text-left px-4 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider hidden lg:table-cell">
                    Date
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-[#222] transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Receipt className="w-3.5 h-3.5 text-amber-500" />
                        </div>
                        <span className="text-white font-mono text-sm font-semibold">
                          {order.orderNumber}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="text-white text-sm">
                          {order.customerName ?? <span className="text-zinc-500 italic">Guest</span>}
                        </p>
                        <p className="text-zinc-500 text-xs mt-0.5">{order.customerPhone}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <div className="flex items-center gap-1.5 text-zinc-400 text-sm">
                        <Package className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="line-clamp-1">
                          {order.items
                            .map((i) => `${i.quantity}× ${i.productName}`)
                            .join(', ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-amber-400 font-semibold text-sm">
                        {formatRupees(order.totalPaisa)}
                      </span>
                      {order.discountPaisa && order.discountPaisa > 0 && (
                        <p className="text-green-500 text-xs mt-0.5">
                          -{formatRupees(order.discountPaisa)} off
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDate(order.createdAt)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {order.whatsappUrl && (
                        <a
                          href={order.whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-900/30 hover:bg-green-900/50 border border-green-800/40 rounded-lg text-green-400 text-xs font-medium transition-colors whitespace-nowrap"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          WhatsApp
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
