'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Trophy,
  LayoutDashboard,
  PlusCircle,
  ClipboardList,
  History,
  Wrench,
  Map,
  Trash2,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

interface AdminSidebarProps {
  displayName: string;
  email: string;
}

const NAV_LINKS = [
  { href: '/admin', label: 'Vue d\'ensemble', icon: LayoutDashboard },
  { href: '/admin/new', label: 'Ajouter une course', icon: PlusCircle },
  { href: '/admin/sync', label: 'Validation courses', icon: ClipboardList },
  { href: '/admin/audit', label: 'Historique', icon: History },
  { href: '/admin/incomplete', label: 'Courses incomplètes', icon: Wrench },
  { href: '/admin/map', label: 'Carte GPS', icon: Map },
  { href: '/admin/deleted', label: 'Corbeille', icon: Trash2 },
];

export default function AdminSidebar({ displayName, email }: AdminSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-gray-200 shrink-0">
        <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center shrink-0">
          <Trophy size={16} className="text-white" />
        </div>
        <span className="text-lg font-bold text-zinc-900 tracking-tight">
          Tri<span className="text-red-500">Race</span>
        </span>
        <span className="ml-auto text-[10px] font-bold text-violet-500 uppercase tracking-wider">
          Admin
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === '/admin'
              ? pathname === href
              : pathname === href || pathname.startsWith(href + '/');
          const isCorbeille = href === '/admin/deleted';
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gray-100 text-zinc-900 font-semibold'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-gray-100'
              }`}
            >
              <Icon
                size={18}
                className={`shrink-0 transition-colors ${
                  isActive
                    ? isCorbeille
                      ? 'text-red-400'
                      : 'text-violet-500'
                    : isCorbeille
                    ? 'text-zinc-500 group-hover:text-red-400'
                    : 'text-zinc-500 group-hover:text-violet-400'
                }`}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="shrink-0 border-t border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900 truncate">{displayName}</p>
            <p className="text-xs text-zinc-500 truncate">{email}</p>
          </div>
        </div>

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-zinc-500 hover:text-zinc-900 hover:bg-gray-100 transition-all"
          >
            <LogOut size={16} />
            Se déconnecter
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center shrink-0">
            <Trophy size={14} className="text-white" />
          </div>
          <span className="text-base font-bold text-zinc-900 tracking-tight">
            TriRace <span className="text-violet-500 text-xs font-bold uppercase tracking-wider">Admin</span>
          </span>
        </div>
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="flex items-center justify-center w-9 h-9 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-gray-100 transition-colors"
          aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Backdrop (mobile) */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/30"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-56 flex flex-col bg-gray-50 border-r border-gray-200 transform transition-transform duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
