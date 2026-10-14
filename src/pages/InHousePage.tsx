import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReservationSync } from '../context/ReservationContext';
import {
  Search, RefreshCw, Loader2, AlertCircle, X, ChevronDown,
  CreditCard, LogOut, Pencil, Receipt, FileText, DoorOpen,
} from 'lucide-react';

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
  phone_number?: string;
  membership_tier?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (d: string) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
};

const nights = (arr: string, dep: string) => {
  const ms = new Date(dep).getTime() - new Date(arr).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
};

const balance = (r: Reservation) =>
  (r.room_rate * nights(r.arrival_date, r.departure_date)).toFixed(2);

// Room number synthesised from confirmation_number for demo purposes
const roomNum = (r: Reservation) => {
  const hash = r.confirmation_number
    .split('')
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return 100 + (hash % 900);
};

// Membership badge colour
const tierBadge: Record<string, string> = {
  None:     'bg-gray-100 text-gray-600',
  Silver:   'bg-gray-200 text-gray-700',
  Gold:     'bg-yellow-100 text-yellow-700',
  Platinum: 'bg-blue-100 text-blue-700',
  Diamond:  'bg-purple-100 text-purple-700',
};

// ── I Want To Menu definition ─────────────────────────────────────────────────
interface IWantToItem {
  id: string;
  label: string;
  icon: React.ElementType;
  group: 'modify' | 'create' | 'view' | 'goto';
  groupLabel: string;
  action?: (id: number) => void;
  danger?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function InHousePage() {
  const navigate = useNavigate();
  const { refreshToken } = useReservationSync();

  // ── Data state ────────────────────────────────────────────────────────────
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [search, setSearch]             = useState('');
  const [selectedId, setSelectedId]     = useState<number | null>(null);
  const [iwantOpen, setIwantOpen]       = useState(false);
  const modalRef                        = useRef<HTMLDivElement>(null);

  // ── Fetch in-house reservations ───────────────────────────────────────────
  const fetchInHouse = async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/reservations?status=Checked+In');
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: Reservation[] = await res.json();
      setReservations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInHouse(); }, [refreshToken]);

  // Close modal on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setIwantOpen(false);
      }
    };
    if (iwantOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [iwantOpen]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const q = search.toLowerCase();
  const filtered = reservations.filter((r) =>
    r.guest_name.toLowerCase().includes(q) ||
    String(roomNum(r)).includes(q) ||
    r.confirmation_number.toLowerCase().includes(q)
  );

  const selected = reservations.find((r) => r.id === selectedId) ?? null;

  // ── I Want To menu items ─────────────────────────────────────────────────
  const menuItems: IWantToItem[] = [
    { id: 'checkout',       label: 'Check Out',         icon: LogOut,     group: 'modify',  groupLabel: 'Modify / Update' },
    { id: 'checkout-early', label: 'Check Out Early',   icon: DoorOpen,   group: 'modify',  groupLabel: 'Modify / Update' },
    { id: 'edit-payment',   label: 'Edit Payment',      icon: CreditCard, group: 'modify',  groupLabel: 'Modify / Update' },
    { id: 'edit-res',       label: 'Edit Reservation',  icon: Pencil,     group: 'modify',  groupLabel: 'Modify / Update' },
    { id: 'invoice',        label: 'Pro-forma Invoice',  icon: FileText,   group: 'create',  groupLabel: 'Create' },
    { id: 'reg-card',       label: 'Registration Card', icon: Receipt,    group: 'create',  groupLabel: 'Create' },
    { id: 'billing',        label: 'Billing',           icon: CreditCard, group: 'goto',    groupLabel: 'Go To' },
    { id: 'delivery',       label: 'Delivery History',  icon: FileText,   group: 'view',    groupLabel: 'View' },
  ];

  const groups: { key: IWantToItem['group']; label: string }[] = [
    { key: 'modify', label: '✏ Modify / Update' },
    { key: 'create', label: '⊕ Create' },
    { key: 'view',   label: '👁 View' },
    { key: 'goto',   label: '→ Go To' },
  ];

  const handleMenuAction = (id: string) => {
    if (!selected) return;
    if (id === 'billing') {
      navigate(`/billing/${selected.id}`);
    }
    setIwantOpen(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#f5f5f5]">

      {/* ── Breadcrumb bar ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-5 py-1.5 text-xs text-gray-500 flex items-center space-x-1 select-none">
        <span>Home</span>
        <span>/</span>
        <span>Front Desk</span>
        <span>/</span>
        <span className="text-[#00828A] font-medium">In House</span>
      </div>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">In House</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Currently checked-in guests
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={fetchInHouse}
            className="flex items-center space-x-1 text-[#00828A] hover:text-[#006066] text-sm px-3 py-1.5 border border-[#00828A] rounded hover:bg-[#e8f5f5] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          {/* Global I Want To… (fires for selected row) */}
          {selected && (
            <div className="relative">
              <button
                id="global-iwant-btn"
                onClick={() => setIwantOpen((o) => !o)}
                className="flex items-center space-x-1 bg-[#0066CC] hover:bg-[#004FA3] text-white text-sm px-4 py-1.5 rounded transition-colors font-medium"
              >
                <span>I Want To...</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Search bar ─────────────────────────────────────────────────── */}
      <div className="bg-[#e8e8e8] border-b border-gray-300 px-5 py-2 flex items-center space-x-2">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
          <input
            id="inhouse-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by guest name, room number, or confirmation #..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#00828A] focus:border-[#00828A] bg-white"
          />
        </div>
        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <span className="text-xs text-gray-500 ml-2">
          {loading ? 'Loading…' : `${filtered.length} guest${filtered.length !== 1 ? 's' : ''} in house`}
        </span>
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-5 py-4">

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center h-48 space-x-2 text-[#00828A]">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">Loading in-house guests…</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex items-center space-x-2 text-red-600 bg-red-50 border border-red-200 rounded p-4">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <DoorOpen className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">No in-house guests found</p>
            {search && <p className="text-xs mt-1">Try clearing your search filter.</p>}
          </div>
        )}

        {/* Table */}
        {!loading && !error && filtered.length > 0 && (
          <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#00828A] text-white text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left font-semibold w-8"></th>
                  <th className="px-4 py-3 text-left font-semibold">Room</th>
                  <th className="px-4 py-3 text-left font-semibold">Guest Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Room Type</th>
                  <th className="px-4 py-3 text-left font-semibold">Arrival</th>
                  <th className="px-4 py-3 text-left font-semibold">Departure</th>
                  <th className="px-4 py-3 text-left font-semibold">Nights</th>
                  <th className="px-4 py-3 text-right font-semibold">Balance (₹)</th>
                  <th className="px-4 py-3 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => {
                  const isSelected = r.id === selectedId;
                  return (
                    <tr
                      key={r.id}
                      id={`inhouse-row-${r.id}`}
                      onClick={() => setSelectedId(isSelected ? null : r.id)}
                      className={`border-b border-gray-100 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#dff0f5] border-l-4 border-l-[#00828A]'
                          : idx % 2 === 0
                          ? 'bg-white hover:bg-[#f0fafa]'
                          : 'bg-gray-50 hover:bg-[#f0fafa]'
                      }`}
                    >
                      {/* Selection indicator */}
                      <td className="px-4 py-3">
                        <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-[#00828A]' : 'bg-transparent'}`} />
                      </td>

                      {/* Room */}
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-[#00828A]">
                          {roomNum(r)}
                        </span>
                      </td>

                      {/* Guest Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-800">{r.guest_name}</span>
                          {r.membership_tier && r.membership_tier !== 'None' && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${tierBadge[r.membership_tier] ?? ''}`}>
                              {r.membership_tier}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-400">{r.confirmation_number}</div>
                      </td>

                      {/* Room Type */}
                      <td className="px-4 py-3 text-gray-600">{r.room_type}</td>

                      {/* Arrival */}
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmt(r.arrival_date)}</td>

                      {/* Departure */}
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmt(r.departure_date)}</td>

                      {/* Nights */}
                      <td className="px-4 py-3 text-gray-600 text-center">
                        {nights(r.arrival_date, r.departure_date)}
                      </td>

                      {/* Balance */}
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">
                        ₹{Number(balance(r)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Per-row I Want To… button */}
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          id={`iwant-btn-${r.id}`}
                          onClick={() => {
                            setSelectedId(r.id);
                            setIwantOpen(true);
                          }}
                          className="inline-flex items-center space-x-1 bg-[#0066CC] hover:bg-[#004FA3] text-white text-xs px-3 py-1.5 rounded transition-colors font-medium whitespace-nowrap"
                        >
                          <span>I Want To...</span>
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-4 py-2 flex items-center justify-between text-xs text-gray-500">
              <span>
                Showing {filtered.length} of {reservations.length} in-house guests
              </span>
              <span>Click a row to select, then use "I Want To…" for actions</span>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          I Want To…  Modal  —  exact OPERA Cloud layout
      ══════════════════════════════════════════════════════════════════ */}
      {iwantOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/30 backdrop-blur-[1px]">
          <div
            ref={modalRef}
            id="iwant-modal"
            className="bg-white rounded-sm shadow-2xl border border-gray-200 w-[760px] max-w-[95vw] overflow-hidden"
            style={{ fontFamily: 'inherit' }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between bg-[#f5f5f5] border-b border-gray-200 px-5 py-3">
              <div>
                <h2 className="text-base font-semibold text-gray-800">I Want To...</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Room {roomNum(selected)} — {selected.guest_name}
                </p>
              </div>
              <button
                id="iwant-modal-close"
                onClick={() => setIwantOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Four-column grid matching OPERA */}
            <div className="grid grid-cols-4 gap-0 divide-x divide-gray-100">
              {groups.map((g) => (
                <div key={g.key} className="px-4 py-4">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    {g.label}
                  </p>
                  <div className="flex flex-col space-y-1">
                    {menuItems
                      .filter((m) => m.group === g.key)
                      .map((m) => (
                        <button
                          key={m.id}
                          id={`iwant-action-${m.id}`}
                          onClick={() => handleMenuAction(m.id)}
                          className={`flex items-center space-x-2 text-left text-sm px-2 py-1.5 rounded hover:bg-[#e8f5f5] transition-colors group ${
                            m.id === 'billing'
                              ? 'text-[#0066CC] font-semibold hover:bg-blue-50'
                              : m.danger
                              ? 'text-red-600 hover:bg-red-50'
                              : 'text-[#00828A] hover:text-[#006066]'
                          }`}
                        >
                          <m.icon className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{m.label}</span>
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Billing section — full-width prominent CTA at bottom */}
            <div className="border-t border-gray-200 bg-[#f0f8ff] px-5 py-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Billing</p>
              <div className="flex flex-wrap gap-2">
                <button
                  id="iwant-action-billing-main"
                  onClick={() => { navigate(`/billing/${selected.id}`); setIwantOpen(false); }}
                  className="flex items-center space-x-1.5 bg-[#0066CC] hover:bg-[#004FA3] text-white text-sm px-4 py-2 rounded transition-colors font-semibold shadow-sm"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Open Billing Dashboard</span>
                </button>
                <button
                  onClick={() => setIwantOpen(false)}
                  className="flex items-center space-x-1.5 text-[#00828A] hover:text-[#006066] border border-[#00828A] text-sm px-4 py-2 rounded transition-colors hover:bg-[#e8f5f5]"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Deposit / Cancellation</span>
                </button>
                <button
                  onClick={() => setIwantOpen(false)}
                  className="flex items-center space-x-1.5 text-[#00828A] hover:text-[#006066] border border-[#00828A] text-sm px-4 py-2 rounded transition-colors hover:bg-[#e8f5f5]"
                >
                  <FileText className="w-4 h-4" />
                  <span>Payment Instructions</span>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-5 py-2 text-xs text-gray-400 flex items-center justify-between">
              <span>Confirmation: {selected.confirmation_number}</span>
              <button
                onClick={() => setIwantOpen(false)}
                className="text-gray-500 hover:text-gray-700 hover:underline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
