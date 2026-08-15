import React, { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';

interface Props {
  user: any;
  onSignOut: () => void;
}

export const AccountMenu: React.FC<Props> = ({ user, onSignOut }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '';
  const email = user?.email || 'Signed in';
  const emailInitials = (user?.email || '')
    .trim()
    .slice(0, 2)
    .toUpperCase() || '??';

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white shadow-sm hover:bg-gray-50"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={email} className="h-9 w-9 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 text-xs font-semibold text-white">
            {emailInitials}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="text-sm font-medium text-gray-900">Signed in as {email}</div>
            <div className="text-xs text-gray-500">Your timelines are stored in Supabase</div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onSignOut();
            }}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      )}
    </div>
  );
};