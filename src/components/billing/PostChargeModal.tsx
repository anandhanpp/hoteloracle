import { useState } from 'react';
import { X, Search, Minus, Plus, Loader2 } from 'lucide-react';

interface WindowSummary {
  balance: number;
  total_charges: number;
  payment_method?: string;
}

interface Props {
  reservationId: number;
  guestName: string;
  roomType: string;
  windowSummaries: Record<number, WindowSummary>;
  defaultWindow?: number;
  onClose: () => void;
  onSuccess: () => void;
  onPostPayment?: () => void;
}

const TRANSACTION_CODES: Record<string, string> = {
  'S010': 'Banquet Food',
  'S020': 'Banquet Beverage',
  'S030': 'Room Service',
  'S040': 'Restaurant',
  'S050': 'Mini Bar',
  'S060': 'Laundry',
  'S070': 'Telephone',
  'S080': 'Internet',
  'S090': 'Parking',
  'S100': 'Spa',
  'S110': 'Business Center',
  'S120': 'Miscellaneous',
};

export default function PostChargeModal({
  reservationId,
  guestName,
  roomType,
  windowSummaries,
  defaultWindow = 1,
  onClose,
  onSuccess,
  onPostPayment,
}: Props) {
  const [selectedWindow, setSelectedWindow] = useState(defaultWindow);
  const [code, setCode]             = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice]           = useState('');
  const [quantity, setQuantity]     = useState(1);
  const [supplement, setSupplement] = useState('');
  const [reference, setReference]   = useState('');
  const [codeSearch, setCodeSearch] = useState('');
  const [showCodeDropdown, setShowCodeDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  const filteredCodes = Object.entries(TRANSACTION_CODES).filter(
    ([k, v]) =>
      k.toLowerCase().includes(codeSearch.toLowerCase()) ||
      v.toLowerCase().includes(codeSearch.toLowerCase())
  );

  const handleCodeSelect = (k: string, v: string) => {
    setCode(k);
    setDescription(v);
    setCodeSearch('');
    setShowCodeDropdown(false);
  };

  const postCharge = async () => {
    const res = await fetch('/api/billing/charge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservation_id: reservationId,
        window_number: selectedWindow,
        transaction_code: code,
        description,
        price: parseFloat(price),
        quantity,
        supplement: supplement || null,
        reference: reference || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message ?? 'Failed to post charge');
    }
  };

  const handleApplyCharge = async () => {
    if (!code || !price) { setError('Transaction Code and Price are required.'); return; }
    setError(''); setSubmitting(true);
    try { await postCharge(); onSuccess(); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unknown error'); }
    finally { setSubmitting(false); }
  };

  const handleApplyAndAddMore = async () => {
    if (!code || !price) { setError('Transaction Code and Price are required.'); return; }
    setError(''); setSubmitting(true);
    try {
      await postCharge();
      setCode(''); setDescription(''); setPrice(''); setQuantity(1);
      setSupplement(''); setReference('');
      onSuccess();
    }
    catch (err) { setError(err instanceof Error ? err.message : 'Unknown error'); }
    finally { setSubmitting(false); }
  };

  const total = price && quantity ? (parseFloat(price) * quantity).toFixed(2) : '0.00';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between bg-[#4d4d4f] text-white px-4 py-3 rounded-t">
          <h2 className="text-sm font-semibold">
            PROP1 - Post charges to {guestName} for Room {roomType}
          </h2>
          <button onClick={onClose} className="hover:text-gray-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Window Tabs */}
        <div className="flex border-b border-gray-300 bg-gray-50 overflow-x-auto">
          {Array.from({ length: 8 }, (_, i) => i + 1).map((w) => {
            const summary = windowSummaries[w];
            const bal = summary?.balance ?? 0;
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
                    <span className="text-[9px] bg-blue-100 text-blue-700 px-1 rounded font-normal">CASH</span>
                  )}
                </div>
                <span className={`font-bold ${bal > 0 ? 'text-gray-800' : 'text-gray-400'}`}>
                  ${bal.toFixed(2)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Window Balance */}
        <div className="px-4 pt-2 pb-1 text-right text-xs text-gray-500 border-b border-gray-100">
          Window {selectedWindow}:{' '}
          <span className="font-semibold text-gray-800">
            ${(windowSummaries[selectedWindow]?.balance ?? 0).toFixed(2)}
          </span>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto px-4 pt-3 pb-2">
          <p className="text-[10px] text-red-500 mb-3">* Required Field</p>

          {error && (
            <div className="mb-3 p-2 bg-red-50 border border-red-300 rounded text-red-700 text-xs">
              {error}
            </div>
          )}

          {/* Code + Description */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="col-span-1 relative">
              <label className="block text-xs font-semibold text-gray-700 mb-1">* Code</label>
              <div className="flex">
                <input
                  type="text"
                  value={code || codeSearch}
                  onChange={(e) => {
                    if (code) setCode('');
                    setCodeSearch(e.target.value);
                    setShowCodeDropdown(true);
                  }}
                  onFocus={() => setShowCodeDropdown(true)}
                  placeholder="S020"
                  className="flex-1 border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-[#00828A] rounded-l"
                />
                <button
                  onClick={() => setShowCodeDropdown(!showCodeDropdown)}
                  className="border border-l-0 border-gray-300 px-2 rounded-r bg-gray-50 hover:bg-gray-100"
                >
                  <Search className="w-3.5 h-3.5 text-gray-500" />
                </button>
              </div>
              {showCodeDropdown && (
                <div className="absolute z-20 top-full left-0 w-64 bg-white border border-gray-300 shadow-lg rounded max-h-48 overflow-y-auto">
                  {filteredCodes.length === 0 ? (
                    <div className="p-2 text-xs text-gray-400">No codes found</div>
                  ) : (
                    filteredCodes.map(([k, v]) => (
                      <button
                        key={k}
                        onMouseDown={() => handleCodeSelect(k, v)}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#e6f7f8] flex justify-between gap-2"
                      >
                        <span className="font-mono font-semibold text-[#00828A]">{k}</span>
                        <span className="text-gray-600 text-right">{v}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Banquet Beverage"
                className="w-full border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-[#00828A] rounded"
              />
            </div>
          </div>

          {/* Price + Quantity + Total */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">* Price</label>
              <div className="flex">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-[#00828A] rounded-l min-w-0"
                />
                <span className="border border-l-0 border-gray-300 px-2 py-1.5 text-xs bg-gray-50 rounded-r text-gray-500 whitespace-nowrap">USD</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">* Quantity</label>
              <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 border-r border-gray-300"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 text-center text-xs py-1.5 focus:outline-none"
                  style={{ width: '3rem' }}
                />
                <button
                  onClick={() => setQuantity(q => q + 1)}
                  className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 border-l border-gray-300"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Total</label>
              <div className="border border-gray-200 px-2 py-1.5 text-xs bg-gray-50 rounded font-semibold text-gray-800">
                ${total}
              </div>
            </div>
          </div>

          {/* Supplement & Reference */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Supplement{' '}
                <span className="ml-0.5 bg-gray-200 text-gray-600 text-[9px] rounded-full px-1 cursor-help" title="Optional note">?</span>
              </label>
              <input
                type="text"
                value={supplement}
                onChange={(e) => setSupplement(e.target.value)}
                className="w-full border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-[#00828A] rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Reference</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-[#00828A] rounded"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-end gap-2 bg-gray-50 rounded-b">
          {onPostPayment && (
            <button
              onClick={() => { onClose(); onPostPayment(); }}
              className="px-4 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-700 transition-colors"
            >
              Post Payment
            </button>
          )}
          <button
            onClick={handleApplyAndAddMore}
            disabled={submitting}
            className="px-4 py-1.5 text-xs border border-[#00828A] text-[#00828A] rounded hover:bg-[#e6f7f8] disabled:opacity-50 transition-colors"
          >
            Apply and Add More Charges
          </button>
          <button
            onClick={handleApplyCharge}
            disabled={submitting}
            className="px-4 py-1.5 text-xs bg-[#00828A] hover:bg-[#006066] text-white rounded flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
            Apply Charge
          </button>
        </div>
      </div>
    </div>
  );
}
