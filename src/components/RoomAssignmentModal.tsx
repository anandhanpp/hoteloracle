import { useEffect, useState } from 'react';
import {
  DoorOpen, CheckCircle2, AlertTriangle, X, Loader2,
  User, Calendar, Bed, Sparkles, Check, Key, ShieldCheck,
} from 'lucide-react';
import { useReservationSync } from '../context/ReservationContext';

export interface AvailableRoom {
  id: string | number;
  _id?: string;
  room_number: string;
  room_type: string;
  housekeeping_status: 'Clean' | 'Dirty' | 'Inspected';
  maintenance_status: 'Active' | 'OOO' | 'OOS';
}

export interface ModalReservation {
  id: string | number;
  guest_name: string;
  confirmation_number: string;
  room_type: string;
  arrival_date: string;
  departure_date: string;
  adults?: number;
  children?: number;
  status: string;
  room_id?: string | number | null;
  room_number?: string | null;
}

interface RoomAssignmentModalProps {
  reservation: ModalReservation | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: any) => void;
}

export default function RoomAssignmentModal({
  reservation,
  isOpen,
  onClose,
  onSuccess,
}: RoomAssignmentModalProps) {
  const { triggerRefresh } = useReservationSync();

  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<AvailableRoom | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMode, setSubmitMode] = useState<'checkin' | 'assign-only'>('checkin');
  const [error, setError] = useState<string | null>(null);

  // Fetch available rooms matching the reservation room type
  useEffect(() => {
    if (!isOpen || !reservation) return;

    setError(null);
    setSelectedRoom(null);
    setLoading(true);

    const fetchAvailableRooms = async () => {
      try {
        const queryParams = new URLSearchParams({
          room_type: reservation.room_type,
        });
        const res = await fetch(`/api/rooms/available?${queryParams.toString()}`);
        if (!res.ok) {
          throw new Error(`Failed to query room inventory (${res.status})`);
        }
        const data: AvailableRoom[] = await res.json();
        setAvailableRooms(data);

        // Pre-select if current room matches or pick the first available
        if (data.length > 0) {
          const currentMatch = data.find((r) => r.room_number === reservation.room_number);
          setSelectedRoom(currentMatch || data[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load available rooms');
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableRooms();
  }, [isOpen, reservation]);

  if (!isOpen || !reservation) return null;

  const handleConfirm = async (action: 'checkin' | 'assign-only') => {
    if (!selectedRoom) {
      setError('Please select an available room number to proceed.');
      return;
    }

    setSubmitting(true);
    setSubmitMode(action);
    setError(null);

    try {
      const nowIso = new Date().toISOString();
      const payload: Record<string, any> = {
        room_id: selectedRoom._id || selectedRoom.id,
        room_number: selectedRoom.room_number,
      };

      if (action === 'checkin') {
        payload.status = 'Checked In';
        payload.checkInTime = nowIso;
        payload.check_in_time = nowIso;
      }

      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Operation failed on server');
      }

      triggerRefresh();
      onSuccess(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update reservation');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-lg shadow-2xl border border-gray-300 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-[#1a3c5e] text-white px-6 py-3.5 flex items-center justify-between border-b border-[#14304c]">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-[#00828A] rounded text-white">
              <DoorOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-wide uppercase">
                Room Assignment & Check-In
              </h2>
              <p className="text-xs text-blue-200">
                Front Desk Operations &bull; Inventory Match
              </p>
            </div>
          </div>
          <button
            id="close-assignment-modal-btn"
            onClick={onClose}
            type="button"
            className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Guest Summary Card */}
          <div className="bg-[#f8fafc] border border-gray-200 rounded-md p-4 text-xs space-y-3">
            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 text-[#00828A]" />
                <span className="font-bold text-sm text-gray-900">
                  {reservation.guest_name}
                </span>
                <span className="bg-blue-100 text-[#1a6fa0] text-[10px] font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                  {reservation.status}
                </span>
              </div>
              <span className="font-mono text-xs font-semibold text-gray-600 bg-white px-2 py-1 border border-gray-200 rounded">
                {reservation.confirmation_number}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-gray-700">
              <div className="flex items-center space-x-2">
                <Bed className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <span className="text-[11px] text-gray-500 block">Booked Room Type</span>
                  <span className="font-semibold text-gray-800 text-xs">
                    {reservation.room_type}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <span className="text-[11px] text-gray-500 block">Stay Schedule</span>
                  <span className="font-medium text-gray-800 text-xs">
                    {formatDate(reservation.arrival_date)} &rarr; {formatDate(reservation.departure_date)}
                  </span>
                </div>
              </div>
            </div>

            {reservation.room_number && (
              <div className="flex items-center space-x-2 pt-1 border-t border-gray-100 text-gray-600">
                <Key className="w-3.5 h-3.5 text-[#00828A]" />
                <span>
                  Currently Assigned Room: <strong className="text-gray-900 font-bold">Room {reservation.room_number}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Smart Room Inventory Selection Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="select-room-number"
                className="block text-xs font-bold text-gray-700 uppercase tracking-wider"
              >
                Available Rooms for <span className="text-[#00828A]">"{reservation.room_type}"</span>
              </label>
              {availableRooms.length > 0 && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center space-x-1">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  <span>{availableRooms.length} Ready & Vacant</span>
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center space-x-2.5 text-xs text-gray-500 py-8 bg-gray-50 rounded border border-dashed border-gray-300">
                <Loader2 className="w-5 h-5 animate-spin text-[#00828A]" />
                <span>Querying inventory for available {reservation.room_type} rooms...</span>
              </div>
            ) : availableRooms.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 space-y-2">
                <div className="flex items-center space-x-2 font-bold text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>No Ready Rooms Available for This Category</span>
                </div>
                <p>
                  There are currently no vacant rooms of type <strong>"{reservation.room_type}"</strong> with status <strong>Inspected</strong> or <strong>Clean</strong>.
                </p>
                <div className="bg-amber-100/70 p-2.5 rounded text-[11px] text-amber-950 flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Tip: Visit Housekeeping Matrix to inspect a cleaned room or upgrade room category.</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Visual Room Grid Quick Pick */}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1">
                  {availableRooms.map((r) => {
                    const isSelected = selectedRoom?.room_number === r.room_number;
                    const isInspected = r.housekeeping_status === 'Inspected';

                    return (
                      <button
                        key={r.room_number}
                        id={`room-pick-${r.room_number}`}
                        type="button"
                        onClick={() => setSelectedRoom(r)}
                        className={`p-3 rounded-md border text-left transition-all relative flex flex-col justify-between ${
                          isSelected
                            ? 'border-[#00828A] bg-[#00828A]/10 ring-2 ring-[#00828A] shadow-xs'
                            : 'border-gray-200 bg-white hover:border-[#00828A]/50 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-gray-900">
                            #{r.room_number}
                          </span>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-[#00828A]" />
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[10px]">
                          <span
                            className={`font-semibold px-1.5 py-0.5 rounded text-[10px] ${
                              isInspected
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {r.housekeeping_status}
                          </span>
                          <span className="text-gray-400">
                            Fl. {r.room_number.charAt(0)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Dropdown Alternative for Enterprise Precision */}
                <div className="pt-2">
                  <select
                    id="select-room-number"
                    value={selectedRoom?.room_number || ''}
                    onChange={(e) => {
                      const found = availableRooms.find((r) => r.room_number === e.target.value);
                      setSelectedRoom(found || null);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-xs bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00828A]"
                  >
                    {availableRooms.map((r) => (
                      <option key={r.room_number} value={r.room_number}>
                        Room {r.room_number} — {r.room_type} ({r.housekeeping_status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-gray-50 px-6 py-3.5 border-t border-gray-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3.5 py-2 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center space-x-2">
            {/* Assign Room Only (Keep Confirmed/Pending) */}
            <button
              id="confirm-assign-only-btn"
              type="button"
              onClick={() => handleConfirm('assign-only')}
              disabled={submitting || loading || availableRooms.length === 0 || !selectedRoom}
              className="px-3.5 py-2 border border-[#1a3c5e] text-[#1a3c5e] hover:bg-blue-50 rounded text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Assign this room without marking the guest as Checked In"
            >
              {submitting && submitMode === 'assign-only' ? (
                <span className="flex items-center space-x-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Assigning...</span>
                </span>
              ) : (
                <span>Assign Room Only</span>
              )}
            </button>

            {/* Assign & Complete Check-In */}
            <button
              id="confirm-checkin-btn"
              type="button"
              onClick={() => handleConfirm('checkin')}
              disabled={submitting || loading || availableRooms.length === 0 || !selectedRoom}
              className="flex items-center space-x-1.5 bg-[#00828A] hover:bg-[#006066] text-white px-4 py-2 rounded text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              title="Assign room, mark as Checked In, and record exact timestamp"
            >
              {submitting && submitMode === 'checkin' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Checking In...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Assign & Check In</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
