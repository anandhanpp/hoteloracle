import { useEffect, useState } from 'react';
import { useReservationSync } from '../context/ReservationContext';
import {
  ChevronLeft, ChevronRight, Users, DoorOpen, ArrowRight, Clock,
  Bed, CheckCircle2, Sparkles, ShieldCheck, User,
} from 'lucide-react';
import RoomsAvailableWidget from '../components/RoomsAvailableWidget';

// ── Types ──────────────────────────────────────────────────────────────────────
// Accept any casing/format coming from the DB ("Checked In", "checked-in", etc.)
interface Reservation {
  id: number;
  guest_name: string;
  confirmation_number: string;
  room_type: string;
  arrival_date: string;   // ISO date string e.g. "2026-09-20"
  departure_date: string;
  adults?: number;
  children?: number;
  status: string;         // kept as string so any format from the API is accepted
}

interface InventorySummary {
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

// ── Hotel capacity ────────────────────────────────────────────────────────────
const TOTAL_ROOMS = 50;

// ── Status normaliser ──────────────────────────────────────────────────────────
// Collapses "Checked In" / "checked-in" / "CHECKED IN" → "checked-in", etc.
const normaliseStatus = (s: string): string =>
  s.toLowerCase().replace(/\s+/g, '-');

const isCheckedIn  = (r: Reservation) => normaliseStatus(r.status) === 'checked-in';
const isCheckedOut = (r: Reservation) => normaliseStatus(r.status) === 'checked-out';
const isConfirmed  = (r: Reservation) => normaliseStatus(r.status) === 'confirmed';
const isPending    = (r: Reservation) => normaliseStatus(r.status) === 'pending';

export default function DashboardPage() {
  // ── Sync token from shared context ───────────────────────────────────────────
  const { refreshToken } = useReservationSync();

  // ── State ────────────────────────────────────────────────────────────────────
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [inventory, setInventory]       = useState<InventorySummary | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  // ── Fetch on mount AND whenever BookingsPage fires triggerRefresh() ──────────
  useEffect(() => {
    setLoading(true);
    setError(null);
    const fetchData = async () => {
      try {
        const [resReservations, resInventory] = await Promise.all([
          fetch('/api/reservations'),
          fetch('/api/inventory/summary'),
        ]);

        if (!resReservations.ok) throw new Error(`Reservations error: ${resReservations.status}`);
        const dataReservations: Reservation[] = await resReservations.json();
        setReservations(dataReservations);

        if (resInventory.ok) {
          const invJson = await resInventory.json();
          setInventory(invJson.summary || invJson);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [refreshToken]); // re-runs every time BookingsPage calls triggerRefresh()

  // ── Today's date string "YYYY-MM-DD" ─────────────────────────────────────────
  const today = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

  // ── Arrivals ─────────────────────────────────────────────────────────────────
  /** All reservations arriving today (any status) */
  const arrivingToday = reservations.filter(
    (r) => r.arrival_date.slice(0, 10) === today
  );
  const expectedArrivals = arrivingToday.length;

  /** Subset of today's arrivals that have already checked in */
  const arrivedCheckedIn = arrivingToday.filter(isCheckedIn).length;

  /** Still pending / confirmed arrival today (not yet checked in) */
  const pendingArrivals = arrivingToday.filter(
    (r) => isConfirmed(r) || isPending(r)
  ).length;

  // ── Advance Check-In ─────────────────────────────────────────────────────────
  /** All currently checked-in guests (not just today's arrivals) */
  const checkedInAll = reservations.filter(isCheckedIn);
  const checkedInIndividuals = checkedInAll.length;

  // ── Departures ───────────────────────────────────────────────────────────────
  /** Reservations whose scheduled departure date is today (any status). */
  const departingToday = reservations.filter(
    (r) => r.departure_date.slice(0, 10) === today
  );
  const expectedDepartures = departingToday.length;

  /**
   * Count of ALL Checked-Out reservations (not filtered by departure_date).
   * This correctly captures early checkouts where the departure_date may be
   * tomorrow or later but the guest has already been checked out in the system.
   */
  const checkedOutAll   = reservations.filter(isCheckedOut).length;
  const checkedOutToday = checkedOutAll; // surface total checked-out count

  // Adults / children among today's scheduled departures (demographics strip)
  const departureAdults   = departingToday.reduce((s, r) => s + (r.adults   ?? 1), 0);
  const departureChildren = departingToday.reduce((s, r) => s + (r.children ?? 0), 0);

  // ── Occupied Tonight (stayovers = checked-in and NOT scheduled to depart today)
  const occupiedTonight = reservations.filter(
    (r) => isCheckedIn(r) && r.departure_date.slice(0, 10) !== today
  ).length;

  /** Total checked-in rooms (used in "60 Minutes" card) */
  const totalCheckedIn = checkedInIndividuals;

  // ── Unified Availability Calculation from Centralized Backend ────────────────
  // Formula: True Available = Total Rooms - (Occupied Rooms + Dirty Rooms + OOO Rooms)
  const totalHotelRooms = inventory?.total ?? TOTAL_ROOMS;
  const roomsAvailable  = inventory ? inventory.available : Math.max(0, TOTAL_ROOMS - reservations.filter(isCheckedIn).length);

  // ── Occupancy % (from synchronized inventory or fallback) ───────────────────
  const occupancyPct = inventory
    ? inventory.occupancy_pct.toFixed(1)
    : ((checkedInIndividuals / TOTAL_ROOMS) * 100).toFixed(1);

  // ── Loading / Error guards ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm animate-pulse">
        Loading reservations…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500 text-sm">
        ⚠ Failed to load data: {error}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4">
      <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-4">

        {/* ── Card 1: Daily Projections (4 cols, 2 rows) ── */}
        <div className="bg-white border border-gray-200 shadow-sm md:col-span-4 md:row-span-2 flex flex-col">
          <div className="p-4 border-b border-gray-100 flex-1">
            <h2 className="text-center text-lg text-gray-700 font-medium mb-3">Daily Projections</h2>
            <div className="flex justify-between items-center bg-gray-50 px-2 py-1 border border-gray-200 mb-6">
              <ChevronLeft className="w-4 h-4 text-[#00828A] cursor-pointer" />
              <span className="text-sm font-semibold text-gray-700">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
              <ChevronRight className="w-4 h-4 text-[#00828A] cursor-pointer" />
            </div>

            {/* ── 3-column projection boxes ── */}
            <div className="grid grid-cols-3 gap-2 mb-6 text-center">

              {/* Individuals = today's confirmed/pending arrivals */}
              <div className="relative">
                <div className="text-xs text-gray-600 font-medium mb-2">Individuals</div>
                <div className="absolute top-5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-[#E8811A]"></div>
                <div className="bg-[#E8811A] text-white p-2 rounded-sm shadow-sm flex flex-col items-start text-sm">
                  <div className="flex justify-between w-full font-bold mb-0.5">
                    <span>Rooms</span>
                    <span>{expectedArrivals}</span>
                  </div>
                  <div className="flex justify-between w-full font-medium mb-0.5">
                    <span>Persons</span>
                    <span>{arrivingToday.reduce((s, r) => s + (r.adults ?? 1) + (r.children ?? 0), 0)}</span>
                  </div>
                  <div className="flex justify-between w-full font-light text-xs">
                    <span>Checked In</span>
                    <span>{arrivedCheckedIn}</span>
                  </div>
                </div>
              </div>

              {/* Confirmed/Pending still to arrive */}
              <div className="relative">
                <div className="text-xs text-gray-600 font-medium mb-2">Pending</div>
                <div className="bg-[#00828A] text-white p-2 rounded-sm shadow-sm flex flex-col items-start text-sm mt-1.5">
                  <div className="flex justify-between w-full font-bold mb-0.5">
                    <span>Rooms</span>
                    <span>{pendingArrivals}</span>
                  </div>
                  <div className="flex justify-between w-full font-medium mb-0.5">
                    <span>Depart</span>
                    <span>{expectedDepartures}</span>
                  </div>
                  <div className="flex justify-between w-full font-light text-xs">
                    <span>Checked Out</span>
                    <span>{checkedOutToday}</span>
                  </div>
                </div>
              </div>

              {/* Occupied Tonight */}
              <div className="relative">
                <div className="text-xs text-gray-600 font-medium mb-2">Occupied Tonight</div>
                <div className="absolute top-5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-[#8A2E88]"></div>
                <div className="bg-[#8A2E88] text-white p-2 rounded-sm shadow-sm flex flex-col items-start text-sm">
                  <div className="flex justify-between w-full font-bold mb-0.5">
                    <span>Rooms</span>
                    <span>{occupiedTonight}</span>
                  </div>
                  <div className="flex justify-between w-full font-medium mb-0.5">
                    <span>Persons</span>
                    <span>{checkedInAll.reduce((s, r) => s + (r.adults ?? 1) + (r.children ?? 0), 0)}</span>
                  </div>
                  <div className="flex justify-between w-full font-light text-xs">
                    <span>VIP</span>
                    <span>0</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Bottom stats list ── */}
            <div className="space-y-2 mt-4 text-sm px-1">
              <div className="flex justify-between border-b border-gray-100 pb-1">
                <span className="text-gray-600">Total Bookings</span>
                <span className="font-semibold text-gray-800">{reservations.length}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-1">
                <span className="text-gray-600">Confirmed</span>
                <span className="font-semibold text-gray-800">{reservations.filter(isConfirmed).length}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-1">
                <span className="text-gray-600">Pending</span>
                <span className="font-semibold text-gray-800">{reservations.filter(isPending).length}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-1">
                <span className="text-gray-600">Expected Arrivals Today</span>
                <span className="font-semibold text-gray-800">{expectedArrivals}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-1">
                <span className="text-gray-600">Occupancy (active rooms)</span>
                <span className="font-semibold text-gray-800">{occupancyPct}%</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-1">
                <span className="text-gray-600">Rooms Occupied / Checked In</span>
                <span className="font-semibold text-gray-800">{checkedInIndividuals}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-1">
                <span className="text-gray-600">Departures / Checked Out</span>
                <span className="font-semibold text-gray-800">{checkedOutAll}</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-gray-600">Scheduled Departures Today</span>
                <span className="font-semibold text-gray-800">{expectedDepartures}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Card 2: Arrivals ── */}
        <div className="bg-white border border-gray-200 shadow-sm md:col-span-4 p-4 flex flex-col justify-between relative">
          <div className="flex justify-between items-start mb-2">
            <div className="text-center w-full">
              <h3 className="text-lg text-gray-700">Arrivals</h3>
              <div className="text-[10px] text-gray-500 uppercase tracking-wide">Today's Arrivals</div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#00828A] cursor-pointer absolute right-6" />
          </div>

          {/* Progress timeline */}
          <div className="relative mt-8 mb-4 px-4">
            <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-purple-200 -translate-y-1/2 z-0"></div>
            {/* Fill proportional to checked-in vs expected */}
            <div
              className="absolute top-1/2 left-4 h-0.5 bg-[#8A2E88] -translate-y-1/2 z-0 transition-all duration-500"
              style={{ width: expectedArrivals > 0 ? `${(arrivedCheckedIn / expectedArrivals) * 50}%` : '0%' }}
            ></div>
            <div className="relative z-10 flex justify-between items-center text-xs font-bold text-gray-700">
              <div className="flex flex-col items-center bg-white px-1">
                <div className="w-2 h-2 rounded-full bg-[#8A2E88] mb-1"></div>
                <span>0</span>
              </div>
              <div className="flex flex-col items-center bg-white px-1 -mt-6">
                <Users className="w-5 h-5 text-gray-400 mb-1" />
                <div className="w-3 h-3 rounded-full border-2 border-[#8A2E88] bg-white mb-1"></div>
                <span className="text-[#8A2E88]">{arrivedCheckedIn}</span>
              </div>
              <div className="flex flex-col items-center bg-white px-1">
                <div className="w-2 h-2 rounded-full bg-purple-200 mb-1"></div>
                <span>{expectedArrivals}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-center items-center space-x-6 mt-4">
            <div className="flex items-center text-[#8A2E88]">
              <DoorOpen className="w-12 h-12 stroke-[1.5]" />
              <ArrowRight className="w-6 h-6 -ml-4 stroke-[3]" />
            </div>
            <div className="flex flex-col items-center bg-purple-50 p-2 rounded">
              <span className="text-xs text-gray-500 mb-1">Expected Arrivals</span>
              <span className="text-3xl font-light text-[#8A2E88]">{expectedArrivals}</span>
            </div>
            <div className="flex flex-col items-center text-gray-400">
              <Clock className="w-6 h-6 text-pink-400 mb-1" />
              <span className="text-xs font-medium">{arrivedCheckedIn}</span>
            </div>
          </div>
        </div>

        {/* ── Card 3: Advance Check In ── */}
        <div className="bg-white border border-gray-200 shadow-sm md:col-span-4 p-4">
          <h3 className="text-center text-lg text-gray-700 mb-6">Advance Check In</h3>
          <div className="grid grid-cols-3 gap-2 text-sm h-full">

            {/* Current – confirmed arrivals due today, not yet checked in */}
            <div className="flex flex-col items-center border-r border-gray-100">
              <span className="text-gray-600 font-medium mb-4">Current</span>
              <div className="w-full px-2 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Individuals</span>
                  <span className="font-semibold text-purple-900">{pendingArrivals}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Blocks</span>
                  <span className="font-semibold text-purple-900">0</span>
                </div>
              </div>
            </div>

            {/* Checked In – all currently checked-in guests */}
            <div className="flex flex-col items-center border-r border-gray-100">
              <span className="text-gray-600 font-medium mb-4">Checked In</span>
              <div className="w-full px-2 space-y-2 bg-purple-50 py-2 rounded-sm -mt-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Individuals</span>
                  <span className="font-semibold text-purple-900 text-lg">{checkedInIndividuals}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Blocks</span>
                  <span className="font-semibold text-purple-900">0</span>
                </div>
              </div>
            </div>

            {/* Total for Today – arrivals checked in today */}
            <div className="flex flex-col items-center">
              <span className="text-gray-600 font-medium mb-4 text-center">Total for Today</span>
              <div className="w-full px-2 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Individuals</span>
                  <span className="font-semibold text-purple-900 text-lg">{arrivedCheckedIn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Blocks</span>
                  <span className="font-semibold text-purple-900">0</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Card 4: Rooms Available (Interactive Forecasting & Category Breakdown) ── */}
        <RoomsAvailableWidget className="md:col-span-8" />

        {/* ── Card 5: 60 Minutes ── */}
        <div className="bg-white border border-gray-200 shadow-sm md:col-span-5 p-4 flex flex-col">
          <h3 className="text-center text-lg text-gray-700 mb-6">60 Minutes</h3>
          <div className="grid grid-cols-2 gap-4 h-full">

            {/* Rooms Checked In */}
            <div className="flex items-center justify-between pl-2">
              <div className="flex items-center text-[#8A2E88]">
                <DoorOpen className="w-10 h-10 stroke-[1.5]" />
                <ArrowRight className="w-5 h-5 -ml-3 stroke-[3]" />
              </div>
              <div className="text-center flex-1">
                <div className="text-[10px] text-gray-500 uppercase">Rooms Checked In</div>
                <div className="text-4xl font-light text-[#8A2E88]">{totalCheckedIn}</div>
              </div>
            </div>

            {/* Rooms Checked Out */}
            <div className="flex items-center justify-between pr-2 border-l border-gray-100 pl-4">
              <div className="text-center flex-1">
                <div className="text-[10px] text-gray-500 uppercase">Rooms Checked Out</div>
                <div className="text-4xl font-light text-[#8A2E88]">{checkedOutToday}</div>
              </div>
              <div className="flex items-center text-[#8A2E88]">
                <ArrowRight className="w-5 h-5 -mr-3 stroke-[3] z-10" />
                <DoorOpen className="w-10 h-10 stroke-[1.5]" />
              </div>
            </div>

            {/* Rooms Inspected (synchronized with inventory) */}
            <div className="flex items-center justify-between pl-2 mt-4 pt-4 border-t border-gray-100">
              <div className="bg-[#6db553] p-2 rounded text-white flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="text-center flex-1">
                <div className="text-[10px] text-gray-500 uppercase">Rooms Inspected</div>
                <div className="text-4xl font-light text-[#6db553]">{inventory?.inspected ?? 0}</div>
              </div>
            </div>

            {/* Rooms Cleaned (synchronized with inventory) */}
            <div className="flex items-center justify-between pr-2 border-l border-gray-100 pl-4 mt-4 pt-4 border-t">
              <div className="text-center flex-1">
                <div className="text-[10px] text-gray-500 uppercase">Rooms Cleaned</div>
                <div className="text-4xl font-light text-[#2b90d9]">{inventory?.clean ?? 0}</div>
              </div>
              <div className="bg-[#2b90d9] p-2 rounded text-white flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Card 6: Departures ── */}
        <div className="bg-white border border-gray-200 shadow-sm md:col-span-7 p-4 flex flex-col justify-between relative">
          <h3 className="text-center text-lg text-gray-700 mb-6">Departures</h3>
          <div className="flex justify-around items-center mb-8">

            {/* Expected Departures */}
            <div className="flex flex-col items-center">
              <span className="text-sm text-gray-600 mb-2">Expected Departures</span>
              <div className="flex items-center">
                <div className="flex items-center text-[#8A2E88] mr-4 relative">
                  <DoorOpen className="w-14 h-14 stroke-[1.5]" />
                  <ArrowRight className="w-8 h-8 -mr-6 stroke-[3] absolute -right-3 bg-white" />
                </div>
                <div className="text-center bg-gray-50 px-4 py-2 border rounded">
                  <div className="text-xs text-gray-500">Rooms</div>
                  <div className="text-3xl font-light text-[#8A2E88]">{expectedDepartures}</div>
                </div>
              </div>
            </div>

            {/* Checked Out */}
            <div className="flex flex-col items-center">
              <span className="text-sm text-gray-600 mb-2">Checked Out</span>
              <div className="flex items-center">
                <div className="text-center bg-gray-50 px-4 py-2 border rounded mr-4">
                  <div className="text-xs text-gray-500">Rooms</div>
                  <div className="text-3xl font-light text-[#8A2E88]">{checkedOutToday}</div>
                </div>
                <div className="flex items-center text-[#8A2E88] relative">
                  <ArrowRight className="w-8 h-8 -ml-4 stroke-[3] absolute -left-2 bg-white z-10" />
                  <DoorOpen className="w-14 h-14 stroke-[1.5]" />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Demographics – dynamically computed from today's departures */}
          <div className="flex justify-between items-center px-8 text-sm text-gray-600 border-t border-gray-100 pt-4">
            {/* Departing guests */}
            <div className="flex items-center space-x-6">
              <div className="flex flex-col items-center">
                <User className="w-5 h-5 text-gray-400 mb-1" />
                <span>Adults <strong className="text-gray-800 font-medium">{departureAdults}</strong></span>
              </div>
              <div className="flex flex-col items-center">
                <User className="w-4 h-4 text-gray-400 mb-1" />
                <span>Children <strong className="text-gray-800 font-medium">{departureChildren}</strong></span>
              </div>
            </div>
            {/* Still to check out */}
            <div className="flex flex-col items-center text-xs">
              <span className="text-gray-400 uppercase">Remaining</span>
              <span className="text-xl font-light text-[#8A2E88]">{expectedDepartures - checkedOutToday}</span>
            </div>
            {/* Arriving guests today */}
            <div className="flex items-center space-x-6">
              <div className="flex flex-col items-center">
                <User className="w-5 h-5 text-gray-400 mb-1" />
                <span>Adults <strong className="text-gray-800 font-medium">
                  {arrivingToday.reduce((s, r) => s + (r.adults ?? 1), 0)}
                </strong></span>
              </div>
              <div className="flex flex-col items-center">
                <User className="w-4 h-4 text-gray-400 mb-1" />
                <span>Children <strong className="text-gray-800 font-medium">
                  {arrivingToday.reduce((s, r) => s + (r.children ?? 0), 0)}
                </strong></span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
