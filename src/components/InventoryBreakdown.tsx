import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, BedDouble, CheckCircle, XCircle, AlertTriangle, TrendingUp } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface RoomTypeBreakdown {
  type_id:        number;
  type_code:      string;
  name:           string;
  base_price:     number;
  total_rooms:    number;
  ooo_rooms:      number;
  sellable_rooms: number;
  occupied_rooms: number;
  available_rooms: number;
  occupancy_pct:  number;
}

interface InventoryData {
  summary: {
    total:         number;
    ooo:           number;
    sellable:      number;
    occupied:      number;
    available:     number;
    occupancy_pct: number;
  };
  breakdown: RoomTypeBreakdown[];
  as_of:     string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function pctColor(pct: number): string {
  if (pct >= 90) return '#dc2626';   // red – near full
  if (pct >= 70) return '#d97706';   // amber
  if (pct >= 40) return '#0066CC';   // blue – mid
  return '#00828A';                   // teal – low
}

function fmt(n: number) { return n.toLocaleString('en-IN'); }
function fmtPrice(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0 });
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function InventoryBreakdown() {
  const [data,    setData]    = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/inventory/breakdown');
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const json: InventoryData = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + auto-refresh every 5 minutes
  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchData]);

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-6 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-48 mb-4" />
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-12 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="bg-white border border-red-200 rounded-sm shadow-sm p-6">
        <div className="flex items-center space-x-2 text-red-600 mb-3">
          <XCircle className="w-5 h-5" />
          <span className="font-semibold text-sm">Inventory Unavailable</span>
        </div>
        <p className="text-xs text-red-500 mb-3">{error}</p>
        <button
          onClick={fetchData}
          className="flex items-center space-x-1.5 text-xs text-[#00828A] hover:underline"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { summary, breakdown, as_of } = data;

  return (
    <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-2">
          <BedDouble className="w-4 h-4 text-[#00828A]" />
          <h2 className="text-sm font-semibold text-gray-700 tracking-wide uppercase">
            Room Inventory Breakdown
          </h2>
          <span className="text-[10px] bg-[#00828A]/10 text-[#006066] px-2 py-0.5 rounded font-medium">
            LIVE
          </span>
        </div>
        <div className="flex items-center space-x-3">
          {lastRefresh && (
            <span className="text-[11px] text-gray-400">
              As of {as_of} · Updated {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center space-x-1 text-[#00828A] hover:text-[#006066] text-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Summary strip ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 divide-x divide-gray-200 border-b border-gray-200">
        {[
          { label: 'Total Rooms',     value: fmt(summary.total),         icon: <BedDouble className="w-4 h-4 text-gray-400" />,     bg: 'bg-white'        },
          { label: 'Occupied',        value: fmt(summary.occupied),       icon: <CheckCircle className="w-4 h-4 text-[#0066CC]" />,  bg: 'bg-blue-50'      },
          { label: 'Available',       value: fmt(summary.available),      icon: <CheckCircle className="w-4 h-4 text-[#00828A]" />,  bg: 'bg-teal-50'      },
          { label: 'Occupancy',       value: `${summary.occupancy_pct}%`, icon: <TrendingUp  className="w-4 h-4 text-amber-500" />,  bg: 'bg-amber-50'     },
        ].map(card => (
          <div key={card.label} className={`${card.bg} px-5 py-3 flex items-center space-x-3`}>
            {card.icon}
            <div>
              <div className="text-xl font-bold text-gray-800 leading-tight">{card.value}</div>
              <div className="text-[11px] text-gray-500">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── OOO warning ─────────────────────────────────────────────────────── */}
      {summary.ooo > 0 && (
        <div className="flex items-center space-x-2 px-5 py-2 bg-amber-50 border-b border-amber-100 text-amber-700 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            <strong>{summary.ooo}</strong> room{summary.ooo > 1 ? 's are' : ' is'} out-of-order (OOO) and excluded from availability counts.
          </span>
        </div>
      )}

      {/* ── Breakdown table ──────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#f8f8f8] border-b border-gray-200">
              <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-2/5">
                Room Type
              </th>
              <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                OOO
              </th>
              <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-[#0066CC] uppercase tracking-wider">
                Occupied
              </th>
              <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-[#00828A] uppercase tracking-wider">
                Available
              </th>
              <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Occupancy
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {breakdown.map((row, idx) => {
              const barColor = pctColor(row.occupancy_pct);
              return (
                <tr
                  key={row.type_id}
                  className={`hover:bg-[#f0f8ff] transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                >
                  {/* Room Type name + code + price */}
                  <td className="px-5 py-3">
                    <div className="flex items-center space-x-2.5">
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white"
                        style={{ background: barColor }}
                      >
                        {row.type_code.slice(0, 3)}
                      </div>
                      <div>
                        <div className="font-medium text-gray-800 text-[13px] leading-tight">{row.name}</div>
                        <div className="text-[11px] text-gray-400">
                          {fmtPrice(row.base_price)}<span className="text-gray-300"> / night</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Total */}
                  <td className="text-center px-3 py-3">
                    <span className="text-gray-700 font-semibold">{row.total_rooms}</span>
                  </td>

                  {/* OOO */}
                  <td className="text-center px-3 py-3">
                    {row.ooo_rooms > 0 ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-[11px] font-semibold">
                        {row.ooo_rooms}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-[11px]">—</span>
                    )}
                  </td>

                  {/* Occupied */}
                  <td className="text-center px-3 py-3">
                    {row.occupied_rooms > 0 ? (
                      <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded bg-blue-100 text-[#0066CC] text-[11px] font-bold">
                        {row.occupied_rooms}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-[11px]">0</span>
                    )}
                  </td>

                  {/* Available */}
                  <td className="text-center px-3 py-3">
                    <span
                      className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded text-[11px] font-bold"
                      style={{
                        background: row.available_rooms > 0 ? 'rgba(0,130,138,0.1)' : 'rgba(220,38,38,0.08)',
                        color:      row.available_rooms > 0 ? '#006066'             : '#dc2626',
                      }}
                    >
                      {row.available_rooms}
                    </span>
                  </td>

                  {/* Occupancy bar */}
                  <td className="px-5 py-3 min-w-[140px]">
                    <div className="flex items-center space-x-2.5">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-2 rounded-full transition-all duration-700"
                          style={{ width: `${row.occupancy_pct}%`, background: barColor }}
                        />
                      </div>
                      <span
                        className="text-[11px] font-semibold w-8 text-right"
                        style={{ color: barColor }}
                      >
                        {row.occupancy_pct}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Totals footer row */}
          <tfoot>
            <tr className="bg-[#f0f4f8] border-t-2 border-gray-300">
              <td className="px-5 py-3 text-[12px] font-bold text-gray-700 uppercase tracking-wide">
                Property Total
              </td>
              <td className="text-center px-3 py-3 font-bold text-gray-800">{summary.total}</td>
              <td className="text-center px-3 py-3">
                {summary.ooo > 0 ? (
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-200 text-amber-800 text-[11px] font-bold">
                    {summary.ooo}
                  </span>
                ) : <span className="text-gray-300 text-[11px]">—</span>}
              </td>
              <td className="text-center px-3 py-3">
                <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded bg-blue-200 text-[#0055BB] text-[11px] font-bold">
                  {summary.occupied}
                </span>
              </td>
              <td className="text-center px-3 py-3">
                <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded text-[11px] font-bold"
                  style={{ background: 'rgba(0,130,138,0.15)', color: '#006066' }}>
                  {summary.available}
                </span>
              </td>
              <td className="px-5 py-3">
                <div className="flex items-center space-x-2.5">
                  <div className="flex-1 bg-gray-300 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 rounded-full transition-all duration-700"
                      style={{ width: `${summary.occupancy_pct}%`, background: pctColor(summary.occupancy_pct) }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-gray-700 w-8 text-right">
                    {summary.occupancy_pct}%
                  </span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
