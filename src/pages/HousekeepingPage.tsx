import { useEffect, useState } from 'react';
import {
  Sparkles, AlertTriangle, Wrench, RefreshCw, Loader2,
  CheckCircle2, X, Search, Bed, User,
  Check,
} from 'lucide-react';
import { useReservationSync } from '../context/ReservationContext';

// ── Types ─────────────────────────────────────────────────────────────────────
export type HousekeepingStatus = 'Clean' | 'Dirty' | 'Inspected';
export type MaintenanceStatus  = 'Active' | 'OOO' | 'OOS';

export interface Room {
  id: number;
  room_number: string;
  room_type: string;
  housekeeping_status: HousekeepingStatus;
  maintenance_status: MaintenanceStatus;
  created_at?: string;
  updated_at?: string;
  reservation_id?: number | null;
  guest_name?: string | null;
  confirmation_number?: string | null;
  arrival_date?: string | null;
  departure_date?: string | null;
  reservation_status?: string | null;
  is_occupied?: number;
}

export default function HousekeepingPage() {
  const { refreshToken, triggerRefresh } = useReservationSync();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | HousekeepingStatus | 'OOO' | 'OOS' | 'Occupied'>('All');
  const [floorFilter, setFloorFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');

  // Modal state
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [modalHKStatus, setModalHKStatus] = useState<HousekeepingStatus>('Clean');
  const [modalMaintStatus, setModalMaintStatus] = useState<MaintenanceStatus>('Active');
  const [updating, setUpdating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Fetch rooms
  const fetchRooms = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/rooms');
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: Room[] = await res.json();
      setRooms(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [refreshToken]);

  // Handle open modal
  const handleOpenRoomModal = (room: Room) => {
    setSelectedRoom(room);
    setModalHKStatus(room.housekeeping_status);
    setModalMaintStatus(room.maintenance_status);
    setModalError(null);
  };

  // Handle submit status update
  const handleSaveRoomStatus = async (
    hk: HousekeepingStatus = modalHKStatus,
    maint: MaintenanceStatus = modalMaintStatus
  ) => {
    if (!selectedRoom) return;
    setUpdating(true);
    setModalError(null);
    try {
      const res = await fetch(`/api/rooms/${selectedRoom.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          housekeeping_status: hk,
          maintenance_status: maint,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update room');

      // Update local state
      setRooms((prev) =>
        prev.map((r) => (r.id === selectedRoom.id ? { ...r, ...data } : r))
      );
      setSelectedRoom((prev) => (prev ? { ...prev, ...data } : null));
      triggerRefresh();
      setSelectedRoom(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setUpdating(false);
    }
  };

  // Filter calculation
  const filteredRooms = rooms.filter((r) => {
    // Search
    const q = search.toLowerCase();
    const matchSearch =
      r.room_number.toLowerCase().includes(q) ||
      r.room_type.toLowerCase().includes(q) ||
      (r.guest_name && r.guest_name.toLowerCase().includes(q));

    if (!matchSearch) return false;

    // Status filter
    if (statusFilter === 'Clean' && r.housekeeping_status !== 'Clean') return false;
    if (statusFilter === 'Dirty' && r.housekeeping_status !== 'Dirty') return false;
    if (statusFilter === 'Inspected' && r.housekeeping_status !== 'Inspected') return false;
    if (statusFilter === 'OOO' && r.maintenance_status !== 'OOO') return false;
    if (statusFilter === 'OOS' && r.maintenance_status !== 'OOS') return false;
    if (statusFilter === 'Occupied' && !r.is_occupied) return false;

    // Floor filter
    if (floorFilter !== 'All' && !r.room_number.startsWith(floorFilter)) return false;

    // Type filter
    if (typeFilter !== 'All' && r.room_type !== typeFilter) return false;

    return true;
  });

  // Metric counts
  const totalCount    = rooms.length;
  const inspectedCount= rooms.filter((r) => r.housekeeping_status === 'Inspected').length;
  const cleanCount    = rooms.filter((r) => r.housekeeping_status === 'Clean').length;
  const dirtyCount    = rooms.filter((r) => r.housekeeping_status === 'Dirty').length;
  const oooCount      = rooms.filter((r) => r.maintenance_status === 'OOO').length;
  const oosCount      = rooms.filter((r) => r.maintenance_status === 'OOS').length;
  const occupiedCount = rooms.filter((r) => r.is_occupied).length;

  // Distinct room types for dropdown
  const roomTypes = Array.from(new Set(rooms.map((r) => r.room_type))).sort();

  return (
    <div className="flex flex-col h-full bg-[#f4f6f8] font-sans">
      {/* ── Top Header Bar ─────────────────────────────────────────────── */}
      <div className="bg-[#1a3c5e] text-white px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 select-none shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="bg-[#00828A] p-2 rounded text-white shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-wide">Housekeeping & Maintenance Matrix</h1>
            <p className="text-xs text-blue-200">Physical Room Status, Quality Inspection, and OOO/OOS Tracking</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchRooms}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 border border-white/20 rounded transition-colors text-white"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Grid</span>
          </button>
        </div>
      </div>

      {/* ── KPI Metrics Bar ────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 select-none text-xs">
        {/* Total */}
        <div className="p-2.5 rounded bg-gray-50 border border-gray-200">
          <div className="text-[11px] font-medium text-gray-500 uppercase">Total Rooms</div>
          <div className="text-lg font-bold text-gray-800">{totalCount}</div>
        </div>

        {/* Inspected - Green */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'Inspected' ? 'All' : 'Inspected')}
          className={`p-2.5 rounded border cursor-pointer transition-all ${
            statusFilter === 'Inspected'
              ? 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-400'
              : 'bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100/70'
          }`}
        >
          <div className="text-[11px] font-medium text-emerald-800 uppercase flex items-center justify-between">
            <span>Inspected</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="text-lg font-bold text-emerald-700">{inspectedCount}</div>
        </div>

        {/* Clean - Blue */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'Clean' ? 'All' : 'Clean')}
          className={`p-2.5 rounded border cursor-pointer transition-all ${
            statusFilter === 'Clean'
              ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-400'
              : 'bg-blue-50/70 border-blue-200 hover:bg-blue-100/70'
          }`}
        >
          <div className="text-[11px] font-medium text-blue-800 uppercase flex items-center justify-between">
            <span>Clean</span>
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          </div>
          <div className="text-lg font-bold text-blue-700">{cleanCount}</div>
        </div>

        {/* Dirty - Red */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'Dirty' ? 'All' : 'Dirty')}
          className={`p-2.5 rounded border cursor-pointer transition-all ${
            statusFilter === 'Dirty'
              ? 'bg-red-100 border-red-500 ring-2 ring-red-400'
              : 'bg-red-50/70 border-red-200 hover:bg-red-100/70'
          }`}
        >
          <div className="text-[11px] font-medium text-red-800 uppercase flex items-center justify-between">
            <span>Dirty</span>
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
          </div>
          <div className="text-lg font-bold text-red-700">{dirtyCount}</div>
        </div>

        {/* OOO - Amber Hazard */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'OOO' ? 'All' : 'OOO')}
          className={`p-2.5 rounded border cursor-pointer transition-all ${
            statusFilter === 'OOO'
              ? 'bg-amber-100 border-amber-500 ring-2 ring-amber-400'
              : 'bg-amber-50/70 border-amber-200 hover:bg-amber-100/70'
          }`}
        >
          <div className="text-[11px] font-medium text-amber-800 uppercase flex items-center justify-between">
            <span>Out of Order</span>
            <AlertTriangle className="w-3 h-3 text-amber-600" />
          </div>
          <div className="text-lg font-bold text-amber-700">{oooCount}</div>
        </div>

        {/* OOS - Purple / Grey */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'OOS' ? 'All' : 'OOS')}
          className={`p-2.5 rounded border cursor-pointer transition-all ${
            statusFilter === 'OOS'
              ? 'bg-purple-100 border-purple-500 ring-2 ring-purple-400'
              : 'bg-purple-50/70 border-purple-200 hover:bg-purple-100/70'
          }`}
        >
          <div className="text-[11px] font-medium text-purple-800 uppercase flex items-center justify-between">
            <span>Out of Service</span>
            <Wrench className="w-3 h-3 text-purple-600" />
          </div>
          <div className="text-lg font-bold text-purple-700">{oosCount}</div>
        </div>

        {/* Occupied */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'Occupied' ? 'All' : 'Occupied')}
          className={`p-2.5 rounded border cursor-pointer transition-all ${
            statusFilter === 'Occupied'
              ? 'bg-teal-100 border-teal-500 ring-2 ring-teal-400'
              : 'bg-teal-50/70 border-teal-200 hover:bg-teal-100/70'
          }`}
        >
          <div className="text-[11px] font-medium text-teal-800 uppercase flex items-center justify-between">
            <span>Occupied</span>
            <User className="w-3 h-3 text-teal-600" />
          </div>
          <div className="text-lg font-bold text-teal-700">{occupiedCount}</div>
        </div>
      </div>

      {/* ── Filters & Controls Toolbar ──────────────────────────────────── */}
      <div className="bg-[#eaedf0] border-b border-gray-300 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search box */}
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search room, type, or guest..."
              className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded bg-white text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#00828A]"
            />
          </div>

          {/* Status buttons */}
          <div className="flex bg-white rounded border border-gray-300 p-0.5 shadow-2xs">
            {(['All', 'Inspected', 'Clean', 'Dirty', 'OOO', 'OOS'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-[#00828A] text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Floor filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-gray-500 font-medium">Floor:</span>
            <select
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
              className="bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-700 focus:outline-none"
            >
              <option value="All">All Floors</option>
              <option value="1">1st Floor (100s)</option>
              <option value="2">2nd Floor (200s)</option>
              <option value="3">3rd Floor (300s)</option>
              <option value="4">4th Floor (400s)</option>
              <option value="5">5th Floor (500s)</option>
            </select>
          </div>

          {/* Room Type filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-gray-500 font-medium">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-700 focus:outline-none"
            >
              <option value="All">All Room Types</option>
              {roomTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-3 text-[11px] text-gray-500 font-medium select-none">
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block"></span>
            <span>Inspected</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block"></span>
            <span>Clean</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded bg-red-500 inline-block"></span>
            <span>Dirty</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block"></span>
            <span>OOO</span>
          </div>
        </div>
      </div>

      {/* ── Main Rooms Grid ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-2 text-[#00828A]">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-sm font-medium">Loading Housekeeping & Maintenance Grid...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm max-w-lg mx-auto flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5" />
            <span>Failed to load rooms: {error}</span>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Bed className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No rooms match the selected filters</p>
            <p className="text-xs text-gray-400 mt-1">Try resetting the status or floor filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3.5">
            {filteredRooms.map((room) => {
              // Housekeeping theme
              const isDirty     = room.housekeeping_status === 'Dirty';
              const isClean     = room.housekeeping_status === 'Clean';
              const isInspected = room.housekeeping_status === 'Inspected';

              // Maintenance state
              const isOOO = room.maintenance_status === 'OOO';
              const isOOS = room.maintenance_status === 'OOS';

              // Color accents
              let cardBg     = 'bg-white';
              let borderColor= 'border-gray-200';
              let badgeBg    = 'bg-gray-100 text-gray-700';

              if (isDirty) {
                cardBg      = 'bg-red-50/40 hover:bg-red-50/70';
                borderColor = 'border-red-300';
                badgeBg     = 'bg-red-100 text-red-800 border-red-200';
              } else if (isClean) {
                cardBg      = 'bg-blue-50/40 hover:bg-blue-50/70';
                borderColor = 'border-blue-300';
                badgeBg     = 'bg-blue-100 text-blue-800 border-blue-200';
              } else if (isInspected) {
                cardBg      = 'bg-emerald-50/40 hover:bg-emerald-50/70';
                borderColor = 'border-emerald-300';
                badgeBg     = 'bg-emerald-100 text-emerald-800 border-emerald-200';
              }

              // OOO overrides with hazard border
              if (isOOO) {
                borderColor = 'border-amber-500 border-dashed border-2';
              }

              return (
                <div
                  key={room.id}
                  id={`room-card-${room.room_number}`}
                  onClick={() => handleOpenRoomModal(room)}
                  className={`relative rounded-md border p-3 flex flex-col justify-between cursor-pointer transition-all duration-150 hover:shadow-md select-none group ${cardBg} ${borderColor}`}
                  style={{ minHeight: '125px' }}
                >
                  {/* Top Header: Room # + HK Badge */}
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xl font-bold text-gray-800 tracking-tight group-hover:text-[#00828A] transition-colors">
                        {room.room_number}
                      </span>
                      <div className="text-[10px] text-gray-500 truncate max-w-[100px]" title={room.room_type}>
                        {room.room_type}
                      </div>
                    </div>

                    {/* Housekeeping badge */}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider ${badgeBg}`}
                    >
                      {room.housekeeping_status}
                    </span>
                  </div>

                  {/* Middle / Indicator area */}
                  <div className="my-2 space-y-1">
                    {/* Maintenance Indicators */}
                    {isOOO && (
                      <div className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center space-x-1 shadow-2xs">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span className="truncate">OUT OF ORDER</span>
                      </div>
                    )}
                    {isOOS && (
                      <div className="bg-purple-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center space-x-1 shadow-2xs">
                        <Wrench className="w-3 h-3 shrink-0" />
                        <span className="truncate">OUT OF SERVICE</span>
                      </div>
                    )}

                    {/* Occupancy info */}
                    {room.is_occupied ? (
                      <div className="flex items-center space-x-1 text-[11px] text-teal-800 bg-teal-100/70 px-1.5 py-0.5 rounded">
                        <User className="w-3 h-3 text-teal-700 shrink-0" />
                        <span className="truncate font-medium">{room.guest_name || 'Occupied'}</span>
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-400 pl-0.5">Vacant</div>
                    )}
                  </div>

                  {/* Bottom footer prompt */}
                  <div className="text-[9px] text-gray-400 group-hover:text-[#00828A] transition-colors flex items-center justify-between border-t border-gray-100 pt-1">
                    <span>Floor {room.room_number.charAt(0)}</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                      Edit &rarr;
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          Room Status Management Modal
      ══════════════════════════════════════════════════════════════════ */}
      {selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div
            id="room-status-modal"
            className="bg-white rounded-lg shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden"
          >
            {/* Modal Header */}
            <div className="bg-[#1a3c5e] text-white px-5 py-4 flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-bold">Room {selectedRoom.room_number}</h2>
                  <span className="text-xs bg-[#00828A] text-white px-2 py-0.5 rounded font-normal">
                    {selectedRoom.room_type}
                  </span>
                </div>
                <p className="text-xs text-blue-200 mt-0.5">Update Housekeeping & Maintenance Status</p>
              </div>
              <button
                onClick={() => setSelectedRoom(null)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Occupancy Banner if occupied */}
              {selectedRoom.is_occupied ? (
                <div className="bg-teal-50 border border-teal-200 rounded p-3 text-xs text-teal-900 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold">
                    <User className="w-4 h-4 text-teal-700" />
                    <span>Currently Occupied</span>
                  </div>
                  <div>Guest: <strong>{selectedRoom.guest_name}</strong></div>
                  <div className="text-[11px] text-teal-700">
                    Conf #{selectedRoom.confirmation_number} &bull; Dep: {selectedRoom.departure_date ? selectedRoom.departure_date.slice(0, 10) : '—'}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded p-2.5 text-xs text-gray-500 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-gray-400" />
                  <span>Room is currently vacant.</span>
                </div>
              )}

              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {modalError}
                </div>
              )}

              {/* 1. Housekeeping Status Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Housekeeping Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {/* Dirty */}
                  <button
                    type="button"
                    onClick={() => setModalHKStatus('Dirty')}
                    className={`py-2 px-3 rounded border text-xs font-bold flex flex-col items-center space-y-1 transition-all ${
                      modalHKStatus === 'Dirty'
                        ? 'bg-red-500 text-white border-red-600 shadow-sm ring-2 ring-red-300'
                        : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                    }`}
                  >
                    <span>Dirty</span>
                    {modalHKStatus === 'Dirty' && <Check className="w-3.5 h-3.5" />}
                  </button>

                  {/* Clean */}
                  <button
                    type="button"
                    onClick={() => setModalHKStatus('Clean')}
                    className={`py-2 px-3 rounded border text-xs font-bold flex flex-col items-center space-y-1 transition-all ${
                      modalHKStatus === 'Clean'
                        ? 'bg-blue-600 text-white border-blue-700 shadow-sm ring-2 ring-blue-300'
                        : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    <span>Clean</span>
                    {modalHKStatus === 'Clean' && <Check className="w-3.5 h-3.5" />}
                  </button>

                  {/* Inspected */}
                  <button
                    type="button"
                    onClick={() => setModalHKStatus('Inspected')}
                    className={`py-2 px-3 rounded border text-xs font-bold flex flex-col items-center space-y-1 transition-all ${
                      modalHKStatus === 'Inspected'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-300'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    <span>Inspected</span>
                    {modalHKStatus === 'Inspected' && <Check className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* 2. Maintenance Status Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Maintenance Status (OOO / OOS)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {/* Active */}
                  <button
                    type="button"
                    onClick={() => setModalMaintStatus('Active')}
                    className={`py-2 px-3 rounded border text-xs font-medium flex flex-col items-center space-y-1 transition-all ${
                      modalMaintStatus === 'Active'
                        ? 'bg-[#00828A] text-white border-[#006066] shadow-sm ring-2 ring-teal-300'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <span className="font-semibold">Active</span>
                    <span className="text-[10px] opacity-80">Available</span>
                  </button>

                  {/* OOO */}
                  <button
                    type="button"
                    onClick={() => setModalMaintStatus('OOO')}
                    className={`py-2 px-3 rounded border text-xs font-medium flex flex-col items-center space-y-1 transition-all ${
                      modalMaintStatus === 'OOO'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-sm ring-2 ring-amber-300'
                        : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    <span className="font-semibold">OOO</span>
                    <span className="text-[10px] opacity-80">Out of Order</span>
                  </button>

                  {/* OOS */}
                  <button
                    type="button"
                    onClick={() => setModalMaintStatus('OOS')}
                    className={`py-2 px-3 rounded border text-xs font-medium flex flex-col items-center space-y-1 transition-all ${
                      modalMaintStatus === 'OOS'
                        ? 'bg-purple-600 text-white border-purple-700 shadow-sm ring-2 ring-purple-300'
                        : 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
                    }`}
                  >
                    <span className="font-semibold">OOS</span>
                    <span className="text-[10px] opacity-80">Out of Service</span>
                  </button>
                </div>
              </div>

              {/* Quick One-Tap Actions */}
              <div className="border-t border-gray-100 pt-3">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-2">
                  Quick Actions
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveRoomStatus('Inspected', 'Active')}
                    className="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors font-medium"
                  >
                    &bull; Mark Ready (Inspected & Active)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveRoomStatus('Dirty', 'Active')}
                    className="px-2.5 py-1 text-xs bg-red-50 text-red-800 hover:bg-red-100 border border-red-200 rounded transition-colors font-medium"
                  >
                    &bull; Mark Needs Cleaning (Dirty)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveRoomStatus('Dirty', 'OOO')}
                    className="px-2.5 py-1 text-xs bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 rounded transition-colors font-medium"
                  >
                    &bull; Set Out of Order (OOO)
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="bg-gray-50 border-t border-gray-200 px-5 py-3 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setSelectedRoom(null)}
                disabled={updating}
                className="px-4 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                id="save-room-status-btn"
                type="button"
                onClick={() => handleSaveRoomStatus(modalHKStatus, modalMaintStatus)}
                disabled={updating}
                className="flex items-center space-x-1.5 bg-[#00828A] hover:bg-[#006066] text-white px-5 py-1.5 rounded text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {updating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
