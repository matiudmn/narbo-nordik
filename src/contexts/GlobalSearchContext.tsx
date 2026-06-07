/**
 * Contexte de la recherche universelle : état d'ouverture de la palette,
 * raccourci clavier global (Cmd/Ctrl+K, et "/" hors champ de saisie), et
 * montage de la palette. À placer dans le Layout (sous tous les providers
 * de données + le Router) pour que la palette accède aux données et navigue.
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { AnimatePresence } from '../lib/motion';
import CommandPalette from '../components/CommandPalette';

interface GlobalSearchContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const GlobalSearchContext = createContext<GlobalSearchContextType | null>(null);

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function GlobalSearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsOpen(v => !v);
        return;
      }
      if (e.key === '/' && !isTypingTarget(e.target)) {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <GlobalSearchContext.Provider value={{ isOpen, open, close }}>
      {children}
      <AnimatePresence>
        {isOpen && <CommandPalette onClose={close} />}
      </AnimatePresence>
    </GlobalSearchContext.Provider>
  );
}

export function useGlobalSearch() {
  const ctx = useContext(GlobalSearchContext);
  if (!ctx) throw new Error('useGlobalSearch must be used within GlobalSearchProvider');
  return ctx;
}
