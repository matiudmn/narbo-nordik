/**
 * Feuille de partage : rend une carte hors-ecran, la capture en PNG a
 * l'ouverture (pour que le partage natif iOS reste dans le geste utilisateur),
 * affiche l'apercu, et propose Partager (feuille native -> groupe WhatsApp),
 * Telecharger PNG, PDF, et Lien WhatsApp. Reutilisable (seance ou semaine).
 */
import { useEffect, useRef, useState, type Ref, type ReactNode } from 'react';
import { Share2, Download, FileText, MessageCircle, X, Loader2 } from 'lucide-react';
import { Button } from './ui';
import {
  nodeToPngBlob, downloadBlob, pngBlobToPdf, canShareImage, shareImage, whatsappLink,
} from '../lib/shareExport';
import { useModalA11y } from '../hooks/useModalA11y';

interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  filenameBase: string;
  shareTitle: string;
  shareText: string;
  /** Portee de l'export (ex. "Toutes", nom du groupe/prepa) affichee avant diffusion. */
  scopeLabel?: string;
  children: (ref: Ref<HTMLDivElement>) => ReactNode;
}

export default function ShareSheet({ open, onClose, filenameBase, shareTitle, shareText, scopeLabel, children }: ShareSheetProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pngUrl, setPngUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [status, setStatus] = useState<'generating' | 'ready' | 'error'>('generating');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Reinitialise l'etat de capture a l'ouverture. Derivation pendant le rendu
  // (comparaison a la valeur precedente de `open`) plutot qu'un setState direct
  // dans l'effect : aucun effet de bord externe, uniquement de l'etat React.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setStatus('generating'); setBlob(null); setPngUrl(null);
    }
  }

  // Capture a l'ouverture (apres rendu de la carte + chargement du logo).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        if (!cardRef.current) return;
        const b = await nodeToPngBlob(cardRef.current);
        if (cancelled) return;
        setBlob(b);
        setPngUrl(URL.createObjectURL(b));
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [open]);

  useEffect(() => () => { if (pngUrl) URL.revokeObjectURL(pngUrl); }, [pngUrl]);

  useModalA11y(open, panelRef, onClose);

  if (!open) return null;

  const canShare = blob ? canShareImage(blob) : false;
  const pngName = `${filenameBase}.png`;

  const handleShare = async () => {
    if (!blob || sharing) return;
    setSharing(true);
    try {
      const outcome = await shareImage(blob, pngName, { title: shareTitle, text: shareText });
      // 'cancelled' : l'utilisateur a ferme la feuille de partage, on ne fait rien.
      // 'unavailable' : l'API a echoue reellement, on retombe sur le telechargement.
      if (outcome === 'unavailable') downloadBlob(blob, pngName);
    } finally {
      setSharing(false);
    }
  };
  const handlePng = () => { if (blob) downloadBlob(blob, pngName); };
  const handlePdf = async () => {
    if (!blob) return;
    setPdfBusy(true);
    try { await pngBlobToPdf(blob, `${filenameBase}.pdf`); } finally { setPdfBusy(false); }
  };
  const handleWhatsAppLink = () => { window.open(whatsappLink(shareText), '_blank', 'noopener'); };

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Partager">
      {/* Carte hors-ecran, uniquement pour la capture */}
      <div style={{ position: 'fixed', left: -99999, top: 0 }} aria-hidden="true">
        {children(cardRef)}
      </div>

      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={panelRef}
        className="absolute inset-x-0 bottom-0 lg:inset-0 lg:m-auto lg:h-fit lg:max-w-md bg-white rounded-t-2xl lg:rounded-2xl p-4 max-h-[90vh] overflow-y-auto safe-bottom"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-neutral-900">Partager</h2>
          <button onClick={onClose} aria-label="Fermer" className="flex items-center justify-center w-9 h-9 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg">
            <X size={18} />
          </button>
        </div>
        {scopeLabel && (
          <p className="text-xs text-neutral-500 -mt-2 mb-3">Portée : <span className="font-medium">{scopeLabel}</span></p>
        )}

        {status === 'generating' && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-neutral-500" role="status">
            <Loader2 size={18} className="animate-spin text-accent" /> Préparation de l'image...
          </div>
        )}
        {status === 'error' && (
          <p className="py-8 text-center text-sm text-danger">Impossible de générer l'image. Réessaie.</p>
        )}
        {pngUrl && (
          <img src={pngUrl} alt="Aperçu du partage" className="w-full rounded-lg border border-neutral-200 mb-3" />
        )}

        <div className="space-y-2">
          {canShare && (
            <Button variant="accent" fullWidth disabled={!blob || sharing} loading={sharing} leftIcon={!sharing ? <Share2 size={16} aria-hidden="true" /> : undefined} onClick={handleShare}>
              Partager (WhatsApp, etc.)
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth disabled={!blob} leftIcon={<Download size={16} aria-hidden="true" />} onClick={handlePng}>
              PNG
            </Button>
            <Button variant="secondary" fullWidth disabled={!blob} loading={pdfBusy} leftIcon={!pdfBusy ? <FileText size={16} aria-hidden="true" /> : undefined} onClick={handlePdf}>
              PDF
            </Button>
          </div>
          <Button variant="ghost" fullWidth leftIcon={<MessageCircle size={16} aria-hidden="true" />} onClick={handleWhatsAppLink}>
            Lien WhatsApp (texte)
          </Button>
        </div>
      </div>
    </div>
  );
}
