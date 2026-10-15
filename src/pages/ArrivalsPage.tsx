import ReservationsPage from './ReservationsPage';

/**
 * ArrivalsPage - Dedicated Front Desk Arrivals View
 *
 * PMS Enterprise Workflow:
 * 1. Table Column: Selection checkbox column removed, replaced with dedicated "Room Number" column.
 * 2. Pop-Up Trigger: Clicking on the Room Number cell or an assignment button instantly opens
 *    the RoomAssignmentModal.
 * 3. Smart Room Filtering: The modal queries backend inventory (/api/rooms/available) and displays
 *    only available room numbers strictly matching the guest's booked Room Type.
 * 4. Room Assignment & Check-In: Staff can select an inspected/clean room number from the list
 *    to assign it to the reservation and complete check-in (recording exact checkInTime).
 * 5. Strict Arrivals Filter: Hides "Checked In" and "Checked Out" guests; shows only expected
 *    arrivals (Confirmed, Pending).
 */
export default function ArrivalsPage() {
  return <ReservationsPage arrivalsOnly={true} />;
}
