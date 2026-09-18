'use client';

import { useEffect, useState, useRef } from 'react';
import { Github, LogOut, User as UserIcon, ChevronDown, ExternalLink } from 'lucide-react';

export interface AuthUser {
  login: string;
  name: string;
  avatar_url: string;
  html_url: string;
  email?: string | null;
}

export function AuthNav() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setMenuOpen(false);
    window.location.href = '/';
  };

  if (loading) {
    return <div className="h-7 w-20 animate-pulse rounded bg-sunken" />;
  }

  if (!user) {
    return (
      <a
        href="/api/auth/github"
        className="flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs font-medium text-ink shadow-2xs hover:bg-sunken hover:border-line-strong transition-colors"
      >
        <Github className="h-3.5 w-3.5" />
        <span>Sign in with GitHub</span>
      </a>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex h-7 items-center gap-2 rounded-full border border-line bg-surface/80 pl-1 pr-2 text-xs font-medium text-ink shadow-2xs hover:bg-sunken hover:border-line-strong transition-colors"
        aria-expanded={menuOpen}
      >
        <img
          src={user.avatar_url || 'https://avatars.githubusercontent.com/u/197761551?v=4'}
          alt={user.login}
          className="h-5 w-5 rounded-full border border-line object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://avatars.githubusercontent.com/u/197761551?v=4';
          }}
        />
        <span className="hidden sm:inline-block max-w-[100px] truncate text-ink-soft hover:text-ink font-mono text-[11px]">
          @{user.login}
        </span>
        <ChevronDown className="h-3 w-3 text-ink-faint" />
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-48 rounded-lg border border-line bg-surface p-1 shadow-lg ring-1 ring-black/5 z-50">
          <div className="border-b border-line px-2.5 py-2">
            <p className="text-xs font-semibold text-ink truncate">{user.name}</p>
            <p className="text-2xs text-ink-faint font-mono truncate">@{user.login}</p>
          </div>

          <div className="py-1">
            <a
              href={user.html_url}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs text-ink-soft hover:bg-sunken hover:text-ink transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>GitHub Profile</span>
            </a>
            <a
              href="/api/auth/github"
              className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs text-ink-soft hover:bg-sunken hover:text-ink transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              <Github className="h-3.5 w-3.5" />
              <span>Switch Account</span>
            </a>
          </div>

          <div className="border-t border-line pt-1">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs text-critical hover:bg-critical-soft/50 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
