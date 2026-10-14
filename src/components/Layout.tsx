import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
  Menu, Cloud, ChevronDown, MessageSquare, Pin, Search, RefreshCw,
  Plus, MoreVertical, User,
} from 'lucide-react';

// ── Front Desk dropdown sub-items ──────────────────────────────────────────────
const FRONT_DESK_MENU = [
  { label: 'Arrivals',        path: '/' },
  { label: 'In House',        path: '/in-house' },
  { label: 'Departures',      path: '/reservations' },
  { label: 'Room Assignment', path: '/reservations' },
];

const NAV_ITEMS = [
  'Client Relations', 'Bookings', 'Front Desk', 'Inventory',
  'Financials', 'Channel', 'Miscellaneous', 'Reports',
];

const TABS = [
  { name: 'Arrivals',      path: '/' },
  { name: 'Reservations',  path: '/reservations' },
  { name: 'Guests',        path: '/guests' },
  { name: 'To Do',         path: '/todo' },
  { name: 'Events',        path: '/events' },
  { name: 'Maintenance',   path: '/maintenance' },
  { name: 'Housekeeping',  path: '/housekeeping' },
];

const NAV_ROUTES: Record<string, string> = {
  'Client Relations': '/client-relations',
  'Bookings':         '/bookings',
  'Front Desk':       '/',
  'Inventory':        '/inventory',
  'Financials':       '/financials',
  'Channel':          '/channel',
  'Miscellaneous':    '/miscellaneous',
  'Reports':          '/reports',
};

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [frontDeskOpen, setFrontDeskOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setFrontDeskOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on route change
  useEffect(() => { setFrontDeskOpen(false); }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#f0f0f0] font-sans text-gray-800 flex flex-col">

      {/* 1. Top Navigation Bar */}
      <header className="bg-[#4d4d4f] text-white flex items-center justify-between px-3 py-1.5 text-sm select-none">
        <div className="flex items-center space-x-4">
          <Menu className="w-5 h-5 cursor-pointer hover:text-gray-300" />
          <div className="flex items-center font-semibold text-lg tracking-wider">
            <span>ORACLE</span>
            <span className="font-light ml-1 text-xs mt-1">Hospitality</span>
          </div>
        </div>
        <div className="flex items-center space-x-6 text-xs">
          <span>Sunday, 08 May, 2016</span>
          <div className="flex items-center space-x-2 bg-[#333] px-2 py-1 rounded">
            <User className="w-4 h-4" />
            <span>PROP1 - First Property In this Schema</span>
            <ChevronDown className="w-3 h-3 ml-1" />
          </div>
        </div>
      </header>

      {/* 2. Secondary Navigation Bar */}
      <div className="bg-white border-b border-gray-300 shadow-sm flex items-center justify-between px-4 py-2 select-none relative z-50">
        <div className="flex items-center space-x-6 whitespace-nowrap overflow-visible">
          <div className="flex items-center space-x-2 text-[#00828A] font-medium mr-4">
            <Cloud className="w-6 h-6 fill-current" />
            <span className="text-lg">OPERA Cloud</span>
          </div>

          {NAV_ITEMS.map((item) => {
            if (item === 'Front Desk') {
              /* ── Front Desk dropdown ─────────────────────────────────────── */
              const isFDActive =
                location.pathname === '/in-house' ||
                location.pathname === '/' ||
                location.pathname === '/reservations';
              return (
                <div key="Front Desk" className="relative" ref={dropdownRef}>
                  <button
                    id="front-desk-dropdown-btn"
                    type="button"
                    onClick={() => setFrontDeskOpen((o) => !o)}
                    className={`flex items-center text-sm space-x-1 focus:outline-none cursor-pointer py-1 px-1 rounded transition-colors ${
                      isFDActive || frontDeskOpen
                        ? 'text-[#006066] font-semibold'
                        : 'text-[#00828A] hover:text-[#006066]'
                    }`}
                  >
                    <span>Front Desk</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-150 ${frontDeskOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {frontDeskOpen && (
                    <div
                      id="front-desk-dropdown-menu"
                      className="absolute left-0 top-full mt-1.5 w-52 bg-white border border-gray-200 shadow-xl rounded-md z-[100] py-1"
                    >
                      {FRONT_DESK_MENU.map((sub) => (
                        <button
                          key={sub.label}
                          type="button"
                          onClick={() => {
                            navigate(sub.path);
                            setFrontDeskOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#e8f5f5] hover:text-[#006066] transition-colors flex items-center justify-between cursor-pointer ${
                            location.pathname === sub.path && sub.path === '/in-house'
                              ? 'bg-[#e8f5f5] text-[#006066] font-medium'
                              : 'text-gray-700'
                          }`}
                        >
                          <span>{sub.label}</span>
                          {sub.path === '/in-house' && (
                            <span className="text-[10px] bg-[#00828A]/10 text-[#00828A] px-1.5 py-0.5 rounded font-medium">
                              Active
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            /* ── All other nav items ──────────────────────────────────────── */
            return (
              <NavLink
                key={item}
                to={NAV_ROUTES[item] ?? '/'}
                className={({ isActive }) =>
                  `flex items-center text-sm space-x-1 ${
                    isActive ? 'text-[#006066] font-semibold' : 'text-[#00828A] hover:text-[#006066]'
                  }`
                }
              >
                <span>{item}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </NavLink>
            );
          })}
        </div>
        <div className="flex items-center space-x-4 text-[#00828A]">
          <Pin className="w-5 h-5 cursor-pointer hover:text-[#006066]" />
          <MessageSquare className="w-5 h-5 cursor-pointer hover:text-[#006066]" />
        </div>
      </div>

      {/* 3. Tertiary Tab Bar & Actions */}
      <div className="bg-white border-b border-gray-200 px-4 pt-2 pb-0 select-none">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="text-xs text-gray-500 mb-1">Home</div>
            <div className="text-xl text-gray-700 font-light mb-1">Hello,</div>
            <div className="text-xs text-[#00828A] flex space-x-1 cursor-pointer hover:underline">
              <span className="text-gray-500 no-underline">Not you?</span>
              <span>Sign in as a different user.</span>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <div className="flex items-center mb-2">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-2 top-1.5" />
                <input
                  type="text"
                  placeholder="Universal Search: Guests, Conf #, Phone..."
                  className="pl-8 pr-2 py-1 border border-gray-300 text-sm focus:outline-none focus:border-[#00828A] w-72 rounded-l-sm"
                />
              </div>
              <button className="bg-[#00828A] hover:bg-[#006066] text-white px-3 py-1 text-sm border border-[#00828A] rounded-r-sm">
                Go
              </button>
            </div>
            <div className="flex items-center space-x-4 text-xs">
              <span className="text-gray-500">Dashboard last updated at 07:28 AM.</span>
              <button className="flex items-center text-[#00828A] hover:underline space-x-1">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-end">
          <div className="flex space-x-1">
            {TABS.map((tab) => {
              const isActive =
                tab.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(tab.path);
              return (
                <NavLink
                  key={tab.path}
                  to={tab.path}
                  end={tab.path === '/'}
                  className={`flex items-center px-4 py-2 border-t border-l border-r rounded-t-sm cursor-pointer space-x-2 text-sm ${
                    isActive
                      ? 'bg-white border-b-2 border-b-[#00828A] text-[#00828A] border-gray-300 font-medium'
                      : 'bg-gray-50 border-transparent border-b border-b-gray-300 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span>{tab.name}</span>
                  <MoreVertical className="w-4 h-4 text-[#00828A]" />
                </NavLink>
              );
            })}
          </div>
          <div className="flex space-x-4 pb-2 text-sm">
            <button className="flex items-center text-[#00828A] hover:underline space-x-1">
              <Plus className="w-4 h-4" />
              <span>Add Page</span>
            </button>
            <button className="flex items-center text-[#00828A] hover:underline space-x-1">
              <Plus className="w-4 h-4" />
              <span>Add New Tiles</span>
            </button>
          </div>
        </div>
      </div>

      {/* Page Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-2 px-4 flex items-center text-xs text-gray-500 select-none">
        <div className="font-bold text-gray-700 tracking-wider mr-4 text-sm flex items-center">
          ORACLE<span className="font-light ml-1 text-[10px] mt-1">Hospitality</span>
        </div>
        <span>Copyright © 2016, 2018, Oracle and/or its affiliates. All rights reserved.</span>
      </footer>
    </div>
  );
}
