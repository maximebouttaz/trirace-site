'use client';

import { useState, useEffect, useRef } from 'react';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Trophy, ArrowRight, LayoutDashboard, Map, GitCompareArrows, Menu, X, CalendarDays, Heart } from 'lucide-react';
import CompareNavIndicator from '@/components/CompareNavIndicator';

const TRICOACH_URL = process.env.NEXT_PUBLIC_TRICOACH_URL || 'https://tricoach.app';

const NAV_LINKS: Array<{
  href: string;
  label: string;
  icon: React.ElementType | null;
  showIndicator?: boolean;
}> = [
  { href: '/courses', label: 'Courses', icon: null },
  { href: '/carte', label: 'Carte', icon: Map },
  { href: '/calendrier', label: 'Calendrier', icon: CalendarDays },
  { href: '/mes-courses', label: 'Mes courses', icon: Heart },
  { href: '/comparateur', label: 'Comparateur', icon: GitCompareArrows, showIndicator: true },
  { href: '/dashboard', label: 'Organisateurs', icon: LayoutDashboard },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Detect scroll for shadow
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!mobileOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [mobileOpen]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <header
      ref={menuRef}
      className={`sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-200/60 transition-shadow duration-200 ${
        scrolled ? 'shadow-sm shadow-black/5' : ''
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 shrink-0"
          onClick={() => setMobileOpen(false)}
        >
          <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center shadow-sm">
            <Trophy size={16} className="text-white" aria-hidden="true" />
          </div>
          <span className="text-lg font-bold text-zinc-900 tracking-tight">
            Tri<span className="text-red-500">Race</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Navigation principale">
          {NAV_LINKS.map(({ href, label, icon: Icon, showIndicator }) => {
            const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'text-zinc-900 bg-gray-100'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-gray-50'
                }`}
              >
                {Icon && <Icon size={14} aria-hidden="true" />}
                {label}
                {showIndicator && <CompareNavIndicator />}
                {/* Active underline dot */}
                {isActive && (
                  <span
                    className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-red-500"
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}

          {/* Separator */}
          <div className="w-px h-5 bg-gray-200 mx-2" aria-hidden="true" />

          {/* CTA */}
          <a
            href={TRICOACH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-orange-500 text-white text-sm font-bold rounded-xl hover:shadow-md hover:shadow-red-500/25 hover:scale-[1.02] transition-all duration-300"
          >
            Planifier ma saison <ArrowRight size={14} aria-hidden="true" />
          </a>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-gray-100 transition-colors duration-200"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu drawer */}
      <div
        id="mobile-nav"
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          mobileOpen ? 'max-h-[32rem] opacity-100' : 'max-h-0 opacity-0'
        }`}
        aria-hidden={!mobileOpen}
      >
        <nav className="px-4 pb-6 pt-2 flex flex-col gap-0.5 border-t border-gray-100 bg-white/98 backdrop-blur-xl" aria-label="Menu mobile">
          {NAV_LINKS.map(({ href, label, icon: Icon, showIndicator }) => {
            const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors duration-200 ${
                  isActive
                    ? 'text-zinc-900 bg-gray-100'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-gray-50'
                }`}
              >
                {Icon && <Icon size={16} aria-hidden="true" className={isActive ? 'text-red-500' : 'text-zinc-400'} />}
                {label}
                {showIndicator && <CompareNavIndicator />}
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" aria-hidden="true" />}
              </Link>
            );
          })}

          <div className="h-px bg-gray-100 my-2" aria-hidden="true" />

          <a
            href={TRICOACH_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileOpen(false)}
            className="flex items-center justify-center gap-2 px-4 py-3.5 bg-gradient-to-r from-red-600 to-orange-500 text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300"
          >
            Planifier ma saison <ArrowRight size={14} aria-hidden="true" />
          </a>
        </nav>
      </div>
    </header>
  );
}
