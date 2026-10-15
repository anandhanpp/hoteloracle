import ReservationsPage from './ReservationsPage';

/**
 * DeparturesPage - Dedicated Departures table component
 * (accessed via Front Desk -> Departures).
 * Pulls from reservations data and strictly filters the list
 * to only display guests whose status is "Checked Out".
 */
export default function DeparturesPage() {
  return <ReservationsPage departuresOnly={true} />;
}
