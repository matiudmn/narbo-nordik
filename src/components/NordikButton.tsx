import { useState, useRef, useEffect, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { motion, DUR, EASE, haptic } from '../lib/motion';

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
    if (!hasNordiked) haptic('light');
    toggleNordik(raceId, user.id);
    window.dispatchEvent(new CustomEvent('nordik-popover-open', { detail: raceId }));
    setShowNames(true);
  };

  return (
    <div className="relative" ref={popoverRef}>
      <motion.button
        onClick={handleClick}
        whileTap={{ scale: 0.85 }}
        transition={{ duration: DUR.fast, ease: EASE.out }}
        className={`flex items-center justify-center gap-1 min-w-[44px] min-h-[44px] transition-colors ${
          hasNordiked ? 'text-danger-500' : 'text-neutral-300 hover:text-danger-300'
        }`}
        aria-label={hasNordiked ? `Retirer le Nordik (${count})` : `Donner un Nordik (${count})`}
        aria-pressed={hasNordiked}
      >
        <motion.span
          animate={hasNordiked ? { scale: [1, 1.4, 1] } : { scale: 1 }}
          transition={{ duration: 0.4, ease: EASE.bounce }}
          className="inline-block"
        >
          <Heart
            size={18}
            fill={hasNordiked ? 'currentColor' : 'none'}
            aria-hidden="true"
          />
        </motion.span>
        {count > 0 && (
          <span className={`text-xs font-bold tabular ${hasNordiked ? 'text-danger-500' : 'text-neutral-400'}`}>
            {count}
          </span>
        )}
      </motion.button>

      {showNames && nordikUsers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: DUR.fast, ease: EASE.out }}
          className="absolute right-0 top-full mt-1 z-50 bg-white border border-neutral-200 rounded-lg shadow-pop px-3 py-2 min-w-[140px]"
        >
          <p className="label-micro text-neutral-400 mb-1">Nordiks</p>
          {nordikUsers.map((name, i) => (
            <p key={i} className="text-xs text-neutral-700 leading-5">{name}</p>
          ))}
        </motion.div>
      )}
    </div>
  );
}
