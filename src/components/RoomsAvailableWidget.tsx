import { useEffect, useRef, useState } from 'react';
import {
  Bed, CheckCircle2, ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  RotateCcw, Sparkles, Loader2,
} from 'lucide-react';
import { useReservationSync } from '../context/ReservationContext';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface RoomTypeAvailability {
  type_id: string | number;
  type_code: string;
  name: string;
  base_price: number;
  total_rooms: number;
  ooo_rooms: number;
  dirty_rooms: number;
  inspected_rooms: number;
  clean_rooms: number;
  occupied_rooms: number;
  sellable_rooms: number;
  available_rooms: number;
  true_available_rooms: number;
  occupancy_pct: number;
}

export interface InventorySummary {
  total: number;
  total_rooms?: number;
  occupied: number;
  occupied_rooms?: number;
  ooo: number;
  ooo_rooms?: number;
  dirty: number;
  dirty_rooms?: number;
  inspected?: number;
  clean?: number;
  sellable: number;
  available: number;
  available_rooms?: number;
  true_available?: number;
  true_available_rooms?: number;
  occupancy_pct: number;
}

interface RoomsAvailableWidgetProps {
  onDateChange?: (dateStr: string) => void;
  className?: string;
}

// ── Category Color Badges ─────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  STD: { bg: '#e8f4fd', text: '#1a6fa0', border: '#a8cfe8' },
  DLX: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  EXE: { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' },
  JNR: { bg: '#fff7ed', text: '#c2410c', border: '#ffedd5' },
  OCN: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  PNT: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
};

export default function RoomsAvailableWidget({ className = '' }: RoomsAvailableWidgetProps) {
  const { refreshToken } = useReservationSync();

  // Today ISO date "YYYY-MM-DD"
  const getTodayStr = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [breakdown, setBreakdown] = useState<RoomTypeAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── Fetch availability for selected target date ──────────────────────────────
  const fetchAvailability = async (targetDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/inventory/summary?date=${encodeURIComponent(targetDate)}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setSummary(data.summary);
      setBreakdown(data.breakdown || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load availability');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailability(selectedDate);
  }, [selectedDate, refreshToken]);

  // ── Date Navigation Helpers ──────────────────────────────────────────────────
  const adjustDate = (days: number) => {
    const curr = new Date(selectedDate);
    if (isNaN(curr.getTime())) return;
    curr.setDate(curr.getDate() + days);
    const nextStr = new Date(curr.getTime() - curr.getTimezoneOffset() * 60000)
      .toISOString()
      .split('T')[0];
    setSelectedDate(nextStr);
  };

  const resetToToday = () => {
    setSelectedDate(getTodayStr());
  };

  const isToday = selectedDate === getTodayStr();

  // ── Horizontal Carousel Scrolling ───────────────────────────────────────────
  const scrollCategories = (offset: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const formattedDateTitle = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    if (isNaN(d.getTime())) return selectedDate;
    if (isToday) return `Today · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className={`bg-white border border-gray-200 shadow-sm p-5 flex flex-col justify-between ${className}`}>
      {/* ── Top Bar: Title & Calendar Date Control ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-semibold text-gray-800">Rooms Available</h3>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
              {isToday ? 'Live Inventory' : 'Forecast Projection'}
            </span>
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00828A]" />}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Ready-for-checkin vacant rooms by category
          </p>
        </div>

        {/* Date Picker & Quick Navigator Controls */}
        <div className="flex items-center space-x-1.5 bg-gray-50 border border-gray-200 rounded-md p-1 select-none">
          <button
            type="button"
            id="rooms-prev-date-btn"
            onClick={() => adjustDate(-1)}
            className="p-1 text-gray-500 hover:text-gray-800 hover:bg-white rounded transition-colors"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Interactive Native Date Input styled cleanly */}
          <div className="relative flex items-center px-1">
            <CalendarIcon className="w-3.5 h-3.5 text-[#00828A] mr-1.5 pointer-events-none" />
            <input
              id="rooms-available-date-picker"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-semibold text-gray-700 bg-transparent focus:outline-none cursor-pointer border-none p-0 pr-1"
            />
          </div>

          <button
            type="button"
            id="rooms-next-date-btn"
            onClick={() => adjustDate(1)}
            className="p-1 text-gray-500 hover:text-gray-800 hover:bg-white rounded transition-colors"
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {!isToday && (
            <button
              type="button"
              id="rooms-today-shortcut-btn"
              onClick={resetToToday}
              className="ml-1 text-[11px] font-semibold text-[#00828A] hover:bg-[#00828A]/10 px-2 py-0.5 rounded transition-colors flex items-center gap-1"
              title="Reset to Today"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Today</span>
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="py-8 text-center text-xs text-red-600 bg-red-50 rounded my-3 border border-red-200">
          Failed to load availability for {selectedDate}: {error}
        </div>
      ) : (
        /* ── Main Content: Metric Ring + Category Scrolling Bar ──────────────── */
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center my-3">
          {/* Main Availability Ring Card (4 cols) */}
          <div className="md:col-span-4 flex flex-col items-center justify-center p-3 bg-gray-50/70 rounded-lg border border-gray-100">
            <div className="relative w-28 h-28 bg-[#00828A] rounded-full flex flex-col items-center justify-center text-white shadow-inner">
              <Bed className="w-8 h-8 mb-0.5" />
              <span className="text-3xl font-light tracking-tight">
                {summary ? summary.available : 0}
              </span>
              <CheckCircle2 className="absolute -top-1 -right-1 w-5 h-5 text-white bg-green-500 rounded-full border-2 border-white" />
            </div>

            <div className="text-center mt-2.5">
              <div className="text-xs font-bold text-gray-800">
                {summary ? `${summary.available} of ${summary.total} Available` : 'Loading...'}
              </div>
              <div className="text-[11px] text-gray-500 font-medium">
                {formattedDateTitle()}
              </div>
            </div>

            {/* Sub-breakdown: Occupied, Dirty, OOO */}
            {summary && (
              <div className="mt-2 text-[10px] text-gray-500 flex items-center justify-center gap-2 flex-wrap border-t border-gray-200 pt-2 w-full">
                <span>Occ: <strong className="text-blue-700">{summary.occupied}</strong></span>
                <span>&bull;</span>
                <span>Dirty: <strong className="text-amber-700">{summary.dirty}</strong></span>
                <span>&bull;</span>
                <span>OOO: <strong className="text-red-600">{summary.ooo}</strong></span>
              </div>
            )}
          </div>

          {/* Room-Type Category Scrolling Bar (8 cols) */}
          <div className="md:col-span-8 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#00828A]" />
                <span>Room Categories Availability</span>
              </span>

              {/* Carousel Left / Right Buttons */}
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  id="category-scroll-left-btn"
                  onClick={() => scrollCategories(-220)}
                  className="p-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                  title="Scroll Left"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  id="category-scroll-right-btn"
                  onClick={() => scrollCategories(220)}
                  className="p-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                  title="Scroll Right"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Scrollable Container */}
            <div
              ref={scrollContainerRef}
              className="flex items-stretch space-x-3 overflow-x-auto pb-2 scroll-smooth select-none focus:outline-none"
              style={{ scrollbarWidth: 'thin' }}
            >
              {breakdown.length === 0 ? (
                <div className="text-xs text-gray-400 py-6 text-center w-full">
                  No category availability data found for {selectedDate}.
                </div>
              ) : (
                breakdown.map((item) => {
                  const prefix = item.type_code ? item.type_code.slice(0, 3) : 'STD';
                  const styleMeta = TYPE_COLORS[prefix] || { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' };

                  return (
                    <div
                      key={item.type_id}
                      className="min-w-[170px] max-w-[190px] shrink-0 p-3 rounded-lg border border-gray-200 bg-white hover:border-[#00828A] hover:shadow-xs transition-all flex flex-col justify-between"
                    >
                      {/* Category Header */}
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded border"
                          style={{
                            background: styleMeta.bg,
                            color: styleMeta.text,
                            borderColor: styleMeta.border,
                          }}
                        >
                          {item.type_code}
                        </span>
                        <span className="text-[11px] font-semibold text-gray-400">
                          Total: {item.total_rooms}
                        </span>
                      </div>

                      {/* Category Name */}
                      <div className="text-xs font-semibold text-gray-800 line-clamp-1 mb-2" title={item.name}>
                        {item.name}
                      </div>

                      {/* Available Big Count */}
                      <div className="flex items-baseline justify-between mt-auto pt-2 border-t border-gray-100">
                        <div>
                          <span className="text-xl font-bold text-[#00828A]">
                            {item.available_rooms}
                          </span>
                          <span className="text-[11px] text-gray-500 ml-1">
                            Available
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium">
                          {item.occupied_rooms} occ
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Footer Info Strip ─────────────────────────────────────────────────── */}
      <div className="text-[11px] text-gray-400 border-t border-gray-100 pt-2.5 flex items-center justify-between">
        <span>
          True Availability Formula: Total − (Occupied + Dirty + OOO)
        </span>
        <span className="text-[#00828A] font-semibold">
          Synchronized PMS Inventory
        </span>
      </div>
    </div>
  );
}
