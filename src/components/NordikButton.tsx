import { useState, useRef, useEffect, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';

interface NordikButtonProps {
  raceId: string;
}

export default function NordikButton({ raceId }: NordikButtonProps) {
  const { user } = useAuth();
  const { raceNordiks, toggleNordik, users } = useData();
  const [showNames, setShowNames] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const nordiks = raceNordiks.filter(n => n.race_id === raceId);
  const count = nordiks.length;
  const hasNordiked = user ? nordiks.some(n => n.user_id === user.id) : false;

  const nordikUsers = nordiks
    .map(n => users.find(u => u.id === n.user_id))
    .filter(Boolean)
    .map(u => `${u!.firstname} ${u!.lastname.charAt(0)}.`);

  const closePopover = useCallback(() => {
    setShowNames(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  // Close when another NordikButton opens or on outside click
  useEffect(() => {
    if (!showNames) return;

    const handleClose = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail !== raceId) closePopover();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        closePopover();
      }
    };

    window.addEventListener('nordik-popover-open', handleClose);
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      window.removeEventListener('nordik-popover-open', handleClose);
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [showNames, raceId, closePopover]);

  // Auto-dismiss after 3s
  useEffect(() => {
    if (!showNames) return;
    timeoutRef.current = setTimeout(closePopover, 3000);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [showNames, closePopover]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    toggleNordik(raceId, user.id);
    window.dispatchEvent(new CustomEvent('nordik-popover-open', { detail: raceId }));
    setShowNames(true);
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={handleClick}
        className={`flex items-center gap-1 transition-all active:scale-125 ${
          hasNordiked ? 'text-red-500' : 'text-gray-300 hover:text-red-300'
        }`}
      >
        <Heart
          size={18}
          fill={hasNordiked ? 'currentColor' : 'none'}
          className={hasNordiked ? 'animate-[pulse_0.3s_ease-in-out]' : ''}
        />
        {count > 0 && (
          <span className={`text-xs font-bold tabular-nums ${hasNordiked ? 'text-red-500' : 'text-gray-400'}`}>
            {count}
          </span>
        )}
      </button>

      {showNames && nordikUsers.length > 0 && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 min-w-[140px]">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Nordiks</p>
          {nordikUsers.map((name, i) => (
            <p key={i} className="text-xs text-gray-700 leading-5">{name}</p>
          ))}
        </div>
      )}
    </div>
  );
}
