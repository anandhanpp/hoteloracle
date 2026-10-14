import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CreditCard, Plus, Printer, RefreshCw,
  Loader2, AlertCircle, ChevronDown, X, Receipt,
  User, Calendar, Bed, Hash,
} from 'lucide-react';
import PostChargeModal from './PostChargeModal';
import PostPaymentModal from './PostPaymentModal';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Reservation {
  id: number;
  guest_name: string;
  confirmation_number: string;
  room_type: string;
  arrival_date: string;
  departure_date: string;
  adults: number;
  children: number;
  status: string;
  room_rate: number;
  payment_mode: string;
  billing_option: string;
  membership_tier?: string;
  phone_number?: string;
}

interface Charge {
  id: number;
  window_number: number;
  transaction_code: string;
  description: string;
  price: number;
  quantity: number;
  total: number;
  supplement?: string;
  reference?: string;
  created_at: string;
}

interface Payment {
  id: number;
  window_number: number;
  payment_method: string;
  amount: number;
  reference?: string;
  supplement?: string;
  card_holder?: string;
  created_at: string;
}

interface WindowData {
  charges: Charge[];
  payments: Payment[];
  total_charges: number;
  total_payments: number;
  balance: number;
}

interface BillingData {
  reservation: Reservation;
  windows: Record<string, WindowData>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (d: string) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
};

const fmtTime = (ts: string) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const nights = (arr: string, dep: string) => {
  const ms = new Date(dep).getTime() - new Date(arr).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
};

const roomNum = (r: Reservation) => {
  const hash = r.confirmation_number
    .split('')
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return 100 + (hash % 900);
};

const WINDOW_LABELS = ['Window 1', 'Window 2', 'Window 3', 'Window 4'];

// ─────────────────────────────────────────────────────────────────────────────
export default function BillingDashboard() {
  const { reservation_id } = useParams<{ reservation_id: string }>();
  const navigate = useNavigate();

  // ── State ─────────────────────────────────────────────────────────────────
  const [data, setData]             = useState<BillingData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [activeWindow, setActiveWindow] = useState(1);
  const [showChargeModal, setShowChargeModal]   = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchBilling = async () => {
    if (!reservation_id) return;
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/billing/${reservation_id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `Server error ${res.status}`);
      }
      const json: BillingData = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBilling(); }, [reservation_id]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const win = data?.windows[activeWindow] ?? null;
  const reservation = data?.reservation ?? null;

  const totalBalance = data
    ? Object.values(data.windows).reduce((s, w) => s + w.balance, 0)
    : 0;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 space-x-2 text-[#00828A]">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Loading billing data…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="flex items-center space-x-3 bg-red-50 border border-red-200 rounded p-4 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-medium">Failed to load billing</p>
            <p className="text-sm mt-0.5">{error}</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/in-house')}
          className="mt-4 flex items-center space-x-2 text-[#00828A] hover:underline text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to In House</span>
        </button>
      </div>
    );
  }

  if (!data || !reservation) return null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#f5f5f5]">

      {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-5 py-1.5 text-xs text-gray-500 flex items-center space-x-1 select-none">
        <button
          onClick={() => navigate('/in-house')}
          className="hover:text-[#00828A] transition-colors"
        >
          Home
        </button>
        <span>/</span>
        <button
          onClick={() => navigate('/in-house')}
          className="hover:text-[#00828A] transition-colors"
        >
          In House
        </button>
        <span>/</span>
        <span className="text-[#00828A] font-medium">Billing — {reservation.guest_name}</span>
      </div>

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <button
            id="billing-back-btn"
            onClick={() => navigate('/in-house')}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-800">
              Billing — Room {roomNum(reservation)}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {reservation.guest_name} · {reservation.confirmation_number}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchBilling}
            className="flex items-center space-x-1 text-[#00828A] hover:text-[#006066] text-sm px-3 py-1.5 border border-[#00828A] rounded hover:bg-[#e8f5f5] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1 text-gray-600 hover:text-gray-800 text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Folio</span>
          </button>
          <button
            id="post-charge-btn"
            onClick={() => setShowChargeModal(true)}
            className="flex items-center space-x-1.5 bg-[#00828A] hover:bg-[#006066] text-white text-sm px-4 py-1.5 rounded transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>Post Charge</span>
          </button>
          <button
            id="post-payment-btn"
            onClick={() => setShowPaymentModal(true)}
            className="flex items-center space-x-1.5 bg-[#0066CC] hover:bg-[#004FA3] text-white text-sm px-4 py-1.5 rounded transition-colors font-medium"
          >
            <CreditCard className="w-4 h-4" />
            <span>Post Payment</span>
          </button>
        </div>
      </div>

      {/* ── Split View ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden" ref={printRef}>

        {/* ── LEFT: Guest / Reservation Info ──────────────────────────── */}
        <aside className="w-72 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto">

          {/* Guest card */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#00828A] flex items-center justify-center text-white font-bold text-sm">
                {reservation.guest_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm leading-tight">{reservation.guest_name}</p>
                {reservation.membership_tier && reservation.membership_tier !== 'None' && (
                  <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-semibold">
                    {reservation.membership_tier}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center space-x-2 text-gray-600">
                <Hash className="w-3.5 h-3.5 text-[#00828A]" />
                <span className="font-medium">Conf #</span>
                <span className="font-mono text-gray-800">{reservation.confirmation_number}</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <Bed className="w-3.5 h-3.5 text-[#00828A]" />
                <span className="font-medium">Room</span>
                <span className="font-mono text-gray-800">{roomNum(reservation)} · {reservation.room_type}</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <Calendar className="w-3.5 h-3.5 text-[#00828A]" />
                <span className="font-medium">Arrival</span>
                <span className="text-gray-800">{fmt(reservation.arrival_date)}</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <Calendar className="w-3.5 h-3.5 text-[#00828A]" />
                <span className="font-medium">Depart</span>
                <span className="text-gray-800">{fmt(reservation.departure_date)}</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <User className="w-3.5 h-3.5 text-[#00828A]" />
                <span className="font-medium">Guests</span>
                <span className="text-gray-800">
                  {reservation.adults} adult{reservation.adults !== 1 ? 's' : ''}
                  {reservation.children > 0 ? `, ${reservation.children} child${reservation.children !== 1 ? 'ren' : ''}` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Rate & billing info */}
          <div className="p-4 border-b border-gray-100 space-y-2 text-xs">
            <p className="font-semibold text-gray-500 uppercase tracking-wider text-[10px] mb-2">Rate & Billing</p>
            <div className="flex justify-between text-gray-700">
              <span>Room Rate</span>
              <span className="font-semibold">₹{Number(reservation.room_rate).toLocaleString('en-IN')}/night</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Nights</span>
              <span className="font-semibold">{nights(reservation.arrival_date, reservation.departure_date)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Room Subtotal</span>
              <span className="font-semibold">
                ₹{(Number(reservation.room_rate) * nights(reservation.arrival_date, reservation.departure_date))
                  .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Payment Mode</span>
              <span className="font-semibold">{reservation.payment_mode}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Billing Option</span>
              <span className="font-semibold">{reservation.billing_option}</span>
            </div>
          </div>

          {/* Total balance summary */}
          <div className="p-4 bg-[#f0fafa]">
            <p className="font-semibold text-gray-500 uppercase tracking-wider text-[10px] mb-3">All Windows — Balance</p>
            {WINDOW_LABELS.map((lbl, i) => {
              const w = data.windows[i + 1];
              if (!w || (w.charges.length === 0 && w.payments.length === 0 && i !== 0)) return null;
              return (
                <div key={i} className="flex justify-between items-center text-xs py-1.5 border-b border-[#d0eaea] last:border-0">
                  <span className="text-gray-600">{lbl}</span>
                  <span className={`font-semibold ${w.balance > 0 ? 'text-red-600' : w.balance < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                    ₹{Math.abs(w.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    {w.balance < 0 ? ' CR' : ''}
                  </span>
                </div>
              );
            })}
            <div className="flex justify-between items-center text-sm font-bold mt-2 pt-2 border-t-2 border-[#00828A]">
              <span className="text-gray-700">Total Balance</span>
              <span className={totalBalance > 0 ? 'text-red-600' : totalBalance < 0 ? 'text-green-600' : 'text-[#00828A]'}>
                ₹{Math.abs(totalBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                {totalBalance < 0 ? ' CR' : ''}
              </span>
            </div>
          </div>
        </aside>

        {/* ── RIGHT: Folio windows ─────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-4">

          {/* Window tabs */}
          <div className="flex space-x-1 mb-4">
            {WINDOW_LABELS.map((lbl, i) => {
              const w = data.windows[i + 1];
              const hasData = w && (w.charges.length > 0 || w.payments.length > 0);
              const isActive = activeWindow === i + 1;
              return (
                <button
                  key={i}
                  id={`billing-window-tab-${i + 1}`}
                  onClick={() => setActiveWindow(i + 1)}
                  className={`flex items-center space-x-2 px-4 py-2 text-sm rounded-t border transition-colors ${
                    isActive
                      ? 'bg-white border-gray-200 border-b-white text-[#00828A] font-semibold -mb-px z-10'
                      : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-[#00828A]'
                  }`}
                >
                  <span>{lbl}</span>
                  {hasData && (
                    <span className={`w-2 h-2 rounded-full ${w.balance > 0 ? 'bg-red-400' : 'bg-green-400'}`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Folio card */}
          {win && (
            <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">

              {/* Window header */}
              <div className="bg-[#00828A] text-white px-5 py-3 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-sm">Folio — Window {activeWindow}</h2>
                  <p className="text-[11px] text-white/80 mt-0.5">
                    {win.charges.length} charge{win.charges.length !== 1 ? 's' : ''} · {win.payments.length} payment{win.payments.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-white/80">Window Balance</p>
                  <p className={`text-lg font-bold ${win.balance > 0 ? 'text-red-300' : win.balance < 0 ? 'text-green-300' : 'text-white'}`}>
                    ₹{Math.abs(win.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    {win.balance < 0 ? ' CR' : ''}
                  </p>
                </div>
              </div>

              {/* Charges section */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center space-x-1.5">
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Charges</span>
                  </h3>
                  <button
                    onClick={() => setShowChargeModal(true)}
                    className="text-xs text-[#00828A] hover:underline flex items-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Charge</span>
                  </button>
                </div>

                {win.charges.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-3 text-center">No charges posted to this window.</p>
                ) : (
                  <div className="overflow-hidden rounded border border-gray-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide text-[10px]">
                          <th className="px-3 py-2 text-left">Date / Time</th>
                          <th className="px-3 py-2 text-left">Code</th>
                          <th className="px-3 py-2 text-left">Description</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                          <th className="px-3 py-2 text-right">Price</th>
                          <th className="px-3 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {win.charges.map((c) => (
                          <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{fmtTime(c.created_at)}</td>
                            <td className="px-3 py-2 font-mono text-gray-700">{c.transaction_code}</td>
                            <td className="px-3 py-2 text-gray-700">{c.description || '—'}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{c.quantity}</td>
                            <td className="px-3 py-2 text-right text-gray-600">₹{Number(c.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-800">₹{Number(c.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 font-semibold text-gray-700">
                          <td colSpan={5} className="px-3 py-2 text-right text-xs">Total Charges</td>
                          <td className="px-3 py-2 text-right text-[#00828A]">
                            ₹{win.total_charges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="mx-4 border-t border-gray-100" />

              {/* Payments section */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center space-x-1.5">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Payments</span>
                  </h3>
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className="text-xs text-[#0066CC] hover:underline flex items-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Post Payment</span>
                  </button>
                </div>

                {win.payments.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-3 text-center">No payments posted to this window.</p>
                ) : (
                  <div className="overflow-hidden rounded border border-gray-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide text-[10px]">
                          <th className="px-3 py-2 text-left">Date / Time</th>
                          <th className="px-3 py-2 text-left">Method</th>
                          <th className="px-3 py-2 text-left">Reference</th>
                          <th className="px-3 py-2 text-left">Card Holder</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {win.payments.map((p) => (
                          <tr key={p.id} className="hover:bg-blue-50 transition-colors">
                            <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{fmtTime(p.created_at)}</td>
                            <td className="px-3 py-2 text-gray-700">{p.payment_method}</td>
                            <td className="px-3 py-2 text-gray-600">{p.reference || '—'}</td>
                            <td className="px-3 py-2 text-gray-600">{p.card_holder || '—'}</td>
                            <td className="px-3 py-2 text-right font-semibold text-green-700">
                              ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 font-semibold text-gray-700">
                          <td colSpan={4} className="px-3 py-2 text-right text-xs">Total Payments</td>
                          <td className="px-3 py-2 text-right text-green-700">
                            ₹{win.total_payments.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Window balance footer */}
              <div className={`px-5 py-3 flex items-center justify-between ${win.balance > 0 ? 'bg-red-50' : win.balance < 0 ? 'bg-green-50' : 'bg-gray-50'} border-t border-gray-100`}>
                <div className="text-xs text-gray-500">
                  Charges: <span className="font-semibold text-gray-700">₹{win.total_charges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  <span className="mx-2">—</span>
                  Payments: <span className="font-semibold text-gray-700">₹{win.total_payments.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="text-sm font-bold">
                  <span className="text-gray-500 mr-1">Balance:</span>
                  <span className={win.balance > 0 ? 'text-red-600' : win.balance < 0 ? 'text-green-600' : 'text-[#00828A]'}>
                    ₹{Math.abs(win.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    {win.balance < 0 ? ' CR' : ''}
                  </span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Post Charge Modal ─────────────────────────────────────────── */}
      {showChargeModal && reservation && data && (
        <PostChargeModal
          reservationId={reservation.id}
          guestName={reservation.guest_name}
          roomType={reservation.room_type}
          windowSummaries={Object.fromEntries(
            Object.entries(data.windows).map(([k, v]) => [
              Number(k),
              { balance: v.balance, total_charges: v.total_charges },
            ])
          )}
          defaultWindow={activeWindow}
          onClose={() => setShowChargeModal(false)}
          onSuccess={() => { setShowChargeModal(false); fetchBilling(); }}
          onPostPayment={() => { setShowChargeModal(false); setShowPaymentModal(true); }}
        />
      )}

      {/* ── Post Payment Modal ────────────────────────────────────────── */}
      {showPaymentModal && reservation && data && (
        <PostPaymentModal
          reservationId={reservation.id}
          guestName={reservation.guest_name}
          roomType={reservation.room_type}
          windowSummaries={Object.fromEntries(
            Object.entries(data.windows).map(([k, v]) => [
              Number(k),
              { balance: v.balance, total_charges: v.total_charges },
            ])
          )}
          defaultWindow={activeWindow}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => { setShowPaymentModal(false); fetchBilling(); }}
          onPostCharge={() => { setShowPaymentModal(false); setShowChargeModal(true); }}
        />
      )}
    </div>
  );
}
