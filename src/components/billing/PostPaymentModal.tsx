import { useState } from 'react';
import { X, Loader2, CreditCard } from 'lucide-react';

interface WindowSummary {
  balance: number;
  total_charges: number;
}

interface Props {
  reservationId: number;
  guestName: string;
  roomType: string;
  windowSummaries: Record<number, WindowSummary>;
  defaultWindow?: number;
  onClose: () => void;
  onSuccess: () => void;
  onPostCharge?: () => void;
}

const PAYMENT_METHODS = [
  'Cash - Cash',
  'Credit Card - Visa',
  'Credit Card - Mastercard',
  'Credit Card - Amex',
  'Debit Card',
  'UPI',
  'Bank Transfer',
  'Bill to Room',
  'Complimentary',
];

export default function PostPaymentModal({
  reservationId,
  guestName,
  roomType,
  windowSummaries,
  defaultWindow = 1,
  onClose,
  onSuccess,
  onPostCharge,
}: Props) {
  const [selectedWindow, setSelectedWindow] = useState(defaultWindow);
  const [method, setMethod]       = useState('Cash - Cash');
  const [amount, setAmount]       = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [reference, setReference] = useState('');
  const [supplement, setSupplement] = useState('');
  const [cardPresent, setCardPresent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');

  const isCard = method.startsWith('Credit Card') || method.startsWith('Debit Card');

  const handleApplyPayment = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('A valid amount is required.');
      return;
    }
    setError(''); setSubmitting(true);
    try {
      const res = await fetch('/api/billing/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservation_id: reservationId,
          window_number: selectedWindow,
          payment_method: method,
          amount: parseFloat(amount),
          card_holder: cardHolder || null,
          reference: reference || null,
          supplement: supplement || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? 'Failed to post payment');
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between bg-[#4d4d4f] text-white px-4 py-3 rounded-t">
          <h2 className="text-sm font-semibold">
            PROP1 - Payment of {guestName} for Room {roomType}
          </h2>
          <div className="flex items-center gap-2">
            {onPostCharge && (
              <button
                onClick={() => { onClose(); onPostCharge(); }}
                className="text-xs bg-[#00828A] hover:bg-[#006066] px-3 py-1 rounded transition-colors"
              >
                Post Charge
              </button>
            )}
            <button onClick={onClose} className="hover:text-gray-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Window Tabs */}
        <div className="flex border-b border-gray-300 bg-gray-50 overflow-x-auto">
          {Array.from({ length: 8 }, (_, i) => i + 1).map((w) => {
            const summary = windowSummaries[w];
            const bal     = summary?.balance ?? 0;
            const isActive = selectedWindow === w;
            return (
              <button
                key={w}
                onClick={() => setSelectedWindow(w)}
                className={`flex flex-col items-start px-3 py-2 text-xs border-r border-gray-300 min-w-[80px] transition-colors flex-shrink-0 ${
                  isActive
                    ? 'bg-white border-b-2 border-b-[#00828A] text-[#00828A] font-semibold'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="font-semibold">{w}</span>
                  {w === 1 && (
                    <span className="text-[9px] bg-blue-100 text-blue-700 px-1 rounded font-normal flex items-center gap-0.5">
                      <CreditCard className="w-2 h-2" /> CASH
                    </span>
                  )}
                </div>
                <span className={`font-bold ${bal > 0 ? 'text-gray-800' : 'text-gray-400'}`}>
                  ${bal.toFixed(2)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
          {error && (
            <div className="mb-3 p-2 bg-red-50 border border-red-300 rounded text-red-700 text-xs">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Method */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">* Method</label>
              <div className="flex gap-1">
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="flex-1 border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-[#00828A] rounded bg-white"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <button className="border border-gray-300 px-2 py-1.5 rounded bg-gray-50 hover:bg-gray-100" title="Currency">
                  <CreditCard className="w-3.5 h-3.5 text-gray-500" />
                </button>
              </div>
              <button
                onClick={() => { setMethod('Cash - Cash'); setCardHolder(''); setCardPresent(false); }}
                className="text-[10px] text-[#00828A] hover:underline mt-0.5"
              >
                Clear
              </button>
            </div>

            {/* Card Holder */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Card Holder</label>
              <input
                type="text"
                value={cardHolder}
                onChange={(e) => setCardHolder(e.target.value)}
                disabled={!isCard}
                className="w-full border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-[#00828A] rounded disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
          </div>

          {/* Card fields (shown only for card payments) */}
          {isCard && (
            <>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-[#00828A] mb-1 cursor-pointer hover:underline">
                  Select a Credit Card Terminal
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Card Number</label>
                  <input
                    type="text"
                    placeholder="•••• •••• •••• ••••"
                    className="w-full border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-[#00828A] rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Expiration</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="MM/YY"
                      className="w-full border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-[#00828A] rounded"
                    />
                    <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cardPresent}
                        onChange={(e) => setCardPresent(e.target.checked)}
                        className="w-3 h-3 accent-[#00828A]"
                      />
                      Card Present
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-3 gap-4 mb-4">
            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">* Amount</label>
              <div className="flex">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={(windowSummaries[selectedWindow]?.balance ?? 0).toFixed(2)}
                  className="flex-1 border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-[#00828A] rounded-l min-w-0"
                />
                <span className="border border-l-0 border-gray-300 px-2 py-1.5 text-xs bg-gray-50 rounded-r text-gray-500">USD</span>
              </div>
              <button
                onClick={() => setAmount((windowSummaries[selectedWindow]?.balance ?? 0).toFixed(2))}
                className="text-[10px] text-[#00828A] hover:underline mt-0.5"
              >
                Change Payment Currency
              </button>
            </div>

            {/* Reference */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Reference</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-[#00828A] rounded"
              />
            </div>

            {/* Supplement */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Supplement</label>
              <input
                type="text"
                value={supplement}
                onChange={(e) => setSupplement(e.target.value)}
                className="w-full border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-[#00828A] rounded"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-end gap-2 bg-gray-50 rounded-b">
          <button
            onClick={handleApplyPayment}
            disabled={submitting}
            className="px-5 py-1.5 text-xs bg-[#00828A] hover:bg-[#006066] text-white rounded flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
            Apply Payment
          </button>
        </div>
      </div>
    </div>
  );
}
