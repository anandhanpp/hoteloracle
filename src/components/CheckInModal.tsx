import { useEffect, useState } from 'react';
import {
  DoorOpen, CheckCircle2, AlertTriangle, X, Loader2,
  User, Calendar, Bed, Sparkles,
} from 'lucide-react';
import { useReservationSync } from '../context/ReservationContext';

interface Room {
  id: number;
  room_number: string;
  room_type: string;
  housekeeping_status: 'Clean' | 'Dirty' | 'Inspected';
  maintenance_status: 'Active' | 'OOO' | 'OOS';
}

interface Reservation {
  id: number;
  guest_name: string;
  confirmation_number: string;
  room_type: string;
  arrival_date: string;
  departure_date: string;
  adults?: number;
  children?: number;
  status: string;
  room_id?: number | null;
  room_number?: string | null;
}

interface CheckInModalProps {
  reservation: Reservation | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: any) => void;
}

export default function CheckInModal({
  reservation,
  isOpen,
  onClose,
  onSuccess,
}: CheckInModalProps) {
  const { triggerRefresh } = useReservationSync();

  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available rooms matching the reservation room type
  useEffect(() => {
    if (!isOpen || !reservation) return;

    setError(null);
    setSelectedRoomId('');
    setLoading(true);

    const fetchRooms = async () => {
      try {
        const url = `/api/rooms/available?room_type=${encodeURIComponent(reservation.room_type)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch rooms: ${res.status}`);
        const data: Room[] = await res.json();
        setAvailableRooms(data);
        if (data.length > 0) {
          setSelectedRoomId(String(data[0].id));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
  }, [isOpen, reservation]);

  if (!isOpen || !reservation) return null;

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId) {
      setError('Please select an inspected room for check-in.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Checked In',
          room_id: Number(selectedRoomId),
          check_in_time: new Date().toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Check-in failed');
      }

      triggerRefresh();
      onSuccess(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-lg shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden">
        {/* Modal Header */}
        <div className="bg-[#00828A] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DoorOpen className="w-5 h-5" />
            <h2 className="text-base font-semibold">Guest Check-In & Room Assignment</h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCheckIn} className="p-6 space-y-5">
          {/* Guest Summary Card */}
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-xs space-y-2">
            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 text-[#00828A]" />
                <span className="font-semibold text-sm text-gray-800">{reservation.guest_name}</span>
              </div>
              <span className="font-mono text-xs text-gray-500">{reservation.confirmation_number}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-gray-600">
              <div className="flex items-center space-x-1.5">
                <Bed className="w-3.5 h-3.5 text-gray-400" />
                <span>
                  <strong>Room Type:</strong> {reservation.room_type}
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span>
                  {fmt(reservation.arrival_date)} &rarr; {fmt(reservation.departure_date)}
                </span>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Room Selection Dropdown */}
          <div className="space-y-2">
            <label
              htmlFor="checkin-room-select"
              className="block text-xs font-bold text-gray-700 uppercase tracking-wider"
            >
              Assign Physical Room <span className="text-red-500">*</span>
            </label>

            {loading ? (
              <div className="flex items-center space-x-2 text-xs text-gray-500 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-[#00828A]" />
                <span>Loading eligible inspected rooms for {reservation.room_type}...</span>
              </div>
            ) : availableRooms.length === 0 ? (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 space-y-1">
                <div className="flex items-center space-x-1.5 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>No Ready Rooms Available</span>
                </div>
                <p>
                  There are currently no empty rooms of type <strong>"{reservation.room_type}"</strong> that are marked as <strong>Inspected</strong> and active.
                </p>
                <p className="text-[11px] text-amber-700">
                  Please visit the <strong>Housekeeping Matrix</strong> to inspect and clear a room before checking in.
                </p>
              </div>
            ) : (
              <div>
                <select
                  id="checkin-room-select"
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00828A] focus:border-transparent font-medium text-gray-800"
                >
                  {availableRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Room {r.room_number} &mdash; {r.room_type} (Inspected &bull; Clean)
                    </option>
                  ))}
                </select>
                <div className="flex items-center space-x-1 text-[11px] text-emerald-600 mt-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    Showing {availableRooms.length} inspected, vacant room{availableRooms.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              id="confirm-checkin-btn"
              type="submit"
              disabled={submitting || loading || availableRooms.length === 0 || !selectedRoomId}
              className="flex items-center space-x-2 bg-[#00828A] hover:bg-[#006066] text-white px-5 py-2 rounded text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking In...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Complete Check-In</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
