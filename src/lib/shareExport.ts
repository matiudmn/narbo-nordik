/**
 * Export et partage des seances : image PNG (ideale pour WhatsApp, apercu
 * inline), PDF (document), et partage natif (feuille de partage du telephone
 * -> le coach choisit le groupe WhatsApp). On ne poste pas automatiquement dans
 * un groupe (pas d'API WhatsApp) : le partage natif est le chemin realiste.
 * html-to-image et jspdf sont charges a la demande (zero surpoids du bundle).
 */

export async function nodeToPngBlob(node: HTMLElement): Promise<Blob> {
  const { toBlob } = await import('html-to-image');
  // skipFonts: la carte utilise des polices systeme ; on evite que html-to-image
  // tente d'inliner les Google Fonts du site (echec CORS + capture ralentie de
  // plusieurs secondes). Capture rapide et sans erreur console.
  const blob = await toBlob(node, { pixelRatio: 2, cacheBust: true, backgroundColor: '#ffffff', skipFonts: true });
  if (!blob) throw new Error('Image non générée');
  return blob;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function imageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/** PDF d'une seule page, a la taille fidele de l'image (faithful). */
export async function pngBlobToPdf(blob: Blob, filename: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const dataUrl = await blobToDataUrl(blob);
  const { width, height } = await imageSize(dataUrl);
  const pdf = new jsPDF({ orientation: width >= height ? 'l' : 'p', unit: 'px', format: [width, height] });
  pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
  pdf.save(filename);
}

/** Le navigateur peut-il partager un fichier image (Web Share API niveau 2) ? */
export function canShareImage(blob: Blob): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
  try {
    const file = new File([blob], 'seance.png', { type: 'image/png' });
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/** Partage natif d'une image. Renvoie true si partagee, false si impossible/annulé. */
export async function shareImage(blob: Blob, filename: string, opts: { title?: string; text?: string }): Promise<boolean> {
  if (!canShareImage(blob)) return false;
  const file = new File([blob], filename, { type: 'image/png' });
  try {
    await navigator.share({ files: [file], title: opts.title, text: opts.text });
    return true;
  } catch {
    return false; // annulation utilisateur ou echec
  }
}

/** Lien WhatsApp pre-rempli (ouvre WhatsApp, le coach choisit le groupe). */
export function whatsappLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
