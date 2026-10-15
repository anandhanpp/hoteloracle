import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
  Menu, Cloud, ChevronDown, MessageSquare, Pin, Search, RefreshCw,
  User,
} from 'lucide-react';

// ── Dropdown Menus Configuration ───────────────────────────────────────────────

const FRONT_DESK_MENU = [
  { label: 'Arrivals',        path: '/arrivals' },
  { label: 'In House',        path: '/in-house' },
  { label: 'Departures',      path: '/departures' },
  { label: 'Reservations',   path: '/reservations' },
];

const INVENTORY_MENU = [
  { label: 'Room Inventory',  path: '/inventory' },
  { label: 'Maintenance',     path: '/maintenance' },
  { label: 'Housekeeping',    path: '/housekeeping' },
];

const REPORTS_MENU = [
  { label: 'Reports Overview', path: '/reports' },
  { label: 'Guests',           path: '/guests' },
  { label: 'To Do',            path: '/todo' },
  { label: 'Events',           path: '/events' },
];

interface NavItem {
  label: string;
  path?: string;
  dropdown?: { label: string; path: string }[];
}

const NAVIGATION_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/' },
  { label: 'Front Desk', dropdown: FRONT_DESK_MENU },
  { label: 'Bookings', path: '/bookings' },
  { label: 'Inventory', dropdown: INVENTORY_MENU },
  { label: 'Financials', path: '/financials' },
  { label: 'Reports', dropdown: REPORTS_MENU },
  { label: 'Client Relations', path: '/client-relations' },
  { label: 'Channel', path: '/channel' },
  { label: 'Miscellaneous', path: '/miscellaneous' },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const navBarRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navBarRef.current && !navBarRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setOpenDropdown(null);
  }, [location.pathname]);

  const isLinkActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/home' || location.pathname === '/dashboard';
    }
    return location.pathname === path || location.pathname.startsWith(path);
  };

  const isDropdownActive = (dropdown: { label: string; path: string }[]) => {
    return dropdown.some((sub) => location.pathname === sub.path);
  };

  // Determine current section title for breadcrumbs
  const getBreadcrumbLabel = () => {
    const p = location.pathname;
    if (p === '/' || p === '/home' || p === '/dashboard') return 'Dashboard';
    const allSubs = [...FRONT_DESK_MENU, ...INVENTORY_MENU, ...REPORTS_MENU];
    const match = allSubs.find((s) => s.path === p);
    if (match) return match.label;
    return p.replace(/^\//, '').replace(/-/g, ' ');
  };

  return (
    <div className="min-h-screen bg-[#f0f0f0] font-sans text-gray-800 flex flex-col">

      {/* 1. Top Enterprise Brand Bar */}
      <header className="bg-[#4d4d4f] text-white flex items-center justify-between px-4 py-1.5 text-sm select-none">
        <div className="flex items-center space-x-4">
          <Menu className="w-5 h-5 cursor-pointer hover:text-gray-300 transition-colors" />
          <div className="flex items-center font-semibold text-lg tracking-wider">
            <span>ORACLE</span>
            <span className="font-light ml-1 text-xs mt-1 text-gray-300">Hospitality</span>
          </div>
        </div>
        <div className="flex items-center space-x-6 text-xs">
          <span className="text-gray-300">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
          <div className="flex items-center space-x-2 bg-[#333] hover:bg-[#2b2b2b] px-2.5 py-1 rounded cursor-pointer transition-colors">
            <User className="w-4 h-4 text-gray-300" />
            <span className="font-medium">PROP1 - First Property In this Schema</span>
            <ChevronDown className="w-3 h-3 ml-1 text-gray-400" />
          </div>
        </div>
      </header>

      {/* 2. Primary Navigation Bar with Clean Dropdowns */}
      <nav
        ref={navBarRef}
        className="bg-white border-b border-gray-300 shadow-xs flex items-center justify-between px-4 py-2 select-none relative z-50"
      >
        <div className="flex items-center space-x-5 whitespace-nowrap overflow-visible">
          {/* Main Landing / Home Branding */}
          <NavLink
            to="/"
            className="flex items-center space-x-2 text-[#00828A] hover:text-[#006066] font-medium mr-3 transition-colors"
            title="OPERA Cloud - Go to Dashboard"
          >
            <Cloud className="w-6 h-6 fill-current" />
            <span className="text-lg font-semibold tracking-tight">OPERA Cloud</span>
          </NavLink>

          {/* Navigation Items (Direct Links + Dropdowns) */}
          {NAVIGATION_ITEMS.map((item) => {
            if (item.dropdown) {
              const active = isDropdownActive(item.dropdown);
              const isOpen = openDropdown === item.label;

              return (
                <div key={item.label} className="relative">
                  <button
                    id={`nav-btn-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    type="button"
                    onClick={() => setOpenDropdown((cur) => (cur === item.label ? null : item.label))}
                    className={`flex items-center text-sm space-x-1.5 focus:outline-none cursor-pointer py-1 px-1.5 rounded transition-colors ${
                      active || isOpen
                        ? 'text-[#006066] font-semibold'
                        : 'text-[#00828A] hover:text-[#006066]'
                    }`}
                  >
                    <span>{item.label}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isOpen && (
                    <div
                      id={`dropdown-menu-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                      className="absolute left-0 top-full mt-1.5 w-56 bg-white border border-gray-200 shadow-xl rounded-md z-[100] py-1 animate-in fade-in zoom-in-95 duration-100"
                    >
                      {item.dropdown.map((sub) => {
                        const isSubActive = location.pathname === sub.path;
                        return (
                          <button
                            key={sub.label}
                            type="button"
                            onClick={() => {
                              navigate(sub.path);
                              setOpenDropdown(null);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#e8f5f5] hover:text-[#006066] transition-colors flex items-center justify-between cursor-pointer ${
                              isSubActive ? 'bg-[#e8f5f5] text-[#006066] font-medium' : 'text-gray-700'
                            }`}
                          >
                            <span>{sub.label}</span>
                            {isSubActive && (
                              <span className="text-[10px] bg-[#00828A]/10 text-[#00828A] px-1.5 py-0.5 rounded font-medium">
                                Active
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Direct route nav link
            const active = isLinkActive(item.path!);
            return (
              <NavLink
                key={item.label}
                to={item.path!}
                end={item.path === '/'}
                className={`flex items-center text-sm space-x-1 py-1 px-1.5 rounded transition-colors ${
                  active ? 'text-[#006066] font-semibold' : 'text-[#00828A] hover:text-[#006066]'
                }`}
              >
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        <div className="flex items-center space-x-4 text-[#00828A]">
          <Pin className="w-5 h-5 cursor-pointer hover:text-[#006066] transition-colors" title="Pin Bar" />
          <MessageSquare className="w-5 h-5 cursor-pointer hover:text-[#006066] transition-colors" title="Messages" />
        </div>
      </nav>

      {/* 3. Clean Enterprise Action Bar (Without category tabs row) */}
      <div className="bg-white border-b border-gray-200 px-5 py-2.5 flex items-center justify-between select-none shadow-2xs">
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <NavLink to="/" className="hover:text-[#00828A] font-medium transition-colors">
            Home
          </NavLink>
          <span>/</span>
          <span className="text-gray-800 font-semibold capitalize">
            {getBreadcrumbLabel()}
          </span>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Universal Search: Guests, Conf #, Phone..."
                className="pl-8 pr-3 py-1.5 border border-gray-300 text-xs focus:outline-none focus:border-[#00828A] w-72 rounded-l-sm bg-gray-50 focus:bg-white transition-colors"
              />
            </div>
            <button className="bg-[#00828A] hover:bg-[#006066] text-white px-3.5 py-1.5 text-xs font-medium border border-[#00828A] rounded-r-sm cursor-pointer transition-colors">
              Search
            </button>
          </div>
          <div className="flex items-center space-x-3 text-xs text-gray-500 border-l border-gray-200 pl-4">
            <span className="hidden sm:inline">Last updated at 07:28 AM</span>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center text-[#00828A] hover:text-[#006066] space-x-1 cursor-pointer font-medium transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Page Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* 5. Footer */}
      <footer className="bg-white border-t border-gray-200 py-2 px-4 flex items-center text-xs text-gray-500 select-none">
        <div className="font-bold text-gray-700 tracking-wider mr-4 text-sm flex items-center">
          ORACLE<span className="font-light ml-1 text-[10px] mt-1 text-gray-400">Hospitality</span>
        </div>
        <span>Copyright © 2016, 2018, Oracle and/or its affiliates. All rights reserved.</span>
      </footer>
    </div>
  );
}
