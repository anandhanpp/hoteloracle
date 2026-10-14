import InventoryBreakdown from '../components/InventoryBreakdown';
import { BedDouble, BarChart2, Settings } from 'lucide-react';

export default function InventoryPage() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-400 mb-0.5 uppercase tracking-wider">Inventory</div>
          <h1 className="text-2xl font-light text-gray-700 flex items-center space-x-2">
            <BedDouble className="w-6 h-6 text-[#00828A]" />
            <span>Room Inventory</span>
          </h1>
        </div>
        <div className="flex items-center space-x-3 text-xs text-[#00828A]">
          <button className="flex items-center space-x-1.5 hover:text-[#006066] hover:underline">
            <BarChart2 className="w-4 h-4" />
            <span>Reports</span>
          </button>
          <button className="flex items-center space-x-1.5 hover:text-[#006066] hover:underline">
            <Settings className="w-4 h-4" />
            <span>Configure</span>
          </button>
        </div>
      </div>

      {/* Live availability breakdown – the main widget */}
      <InventoryBreakdown />

    </div>
  );
}
