import { describe, it, expect, vi, afterEach } from 'vitest';
import { canShareFile, shareFile, canShareImage, shareImage, isStandaloneDisplay } from './shareExport';

const blob = () => new Blob(['contenu'], { type: 'text/csv' });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isStandaloneDisplay', () => {
  it('renvoie false hors PWA installee', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    vi.stubGlobal('navigator', {});
    expect(isStandaloneDisplay()).toBe(false);
  });

  it('renvoie true via matchMedia (display-mode: standalone)', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    vi.stubGlobal('navigator', {});
    expect(isStandaloneDisplay()).toBe(true);
  });

  it('renvoie true via navigator.standalone (ancien Safari iOS)', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    vi.stubGlobal('navigator', { standalone: true });
    expect(isStandaloneDisplay()).toBe(true);
  });
});

describe('canShareFile', () => {
  it('renvoie false sans navigator.canShare', () => {
    vi.stubGlobal('navigator', {});
    expect(canShareFile(blob(), 'export.csv', 'text/csv')).toBe(false);
  });

  it('relaie le verdict de navigator.canShare', () => {
    const canShare = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { canShare });
    expect(canShareFile(blob(), 'export.csv', 'text/csv')).toBe(true);
    expect(canShare).toHaveBeenCalledWith({ files: [expect.any(File)] });
  });

  it('renvoie false si navigator.canShare échoue', () => {
    vi.stubGlobal('navigator', {
      canShare: () => {
        throw new Error('non supporté');
      },
    });
    expect(canShareFile(blob(), 'export.csv', 'text/csv')).toBe(false);
  });
});

describe('shareFile', () => {
  it("renvoie 'unavailable' sans partage natif possible", async () => {
    vi.stubGlobal('navigator', {});
    const outcome = await shareFile(blob(), 'export.csv', 'text/csv', {});
    expect(outcome).toBe('unavailable');
  });

  it("renvoie 'shared' quand navigator.share aboutit", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { canShare: () => true, share });
    const outcome = await shareFile(blob(), 'export.csv', 'text/csv', { title: 'Export' });
    expect(outcome).toBe('shared');
    expect(share).toHaveBeenCalledWith({ files: [expect.any(File)], title: 'Export', text: undefined });
  });

  it("renvoie 'cancelled' quand l'utilisateur ferme la feuille de partage", async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error('annulé'), { name: 'AbortError' }));
    vi.stubGlobal('navigator', { canShare: () => true, share });
    const outcome = await shareFile(blob(), 'export.csv', 'text/csv', {});
    expect(outcome).toBe('cancelled');
  });

  it("renvoie 'unavailable' si le partage échoue réellement", async () => {
    const share = vi.fn().mockRejectedValue(new Error('échec'));
    vi.stubGlobal('navigator', { canShare: () => true, share });
    const outcome = await shareFile(blob(), 'export.csv', 'text/csv', {});
    expect(outcome).toBe('unavailable');
  });
});

describe('canShareImage / shareImage', () => {
  it('canShareImage réutilise canShareFile avec un fichier PNG', () => {
    const canShare = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { canShare });
    expect(canShareImage(new Blob(['x'], { type: 'image/png' }))).toBe(true);
    const [[{ files }]] = canShare.mock.calls;
    expect(files[0].type).toBe('image/png');
  });

  it('shareImage réutilise shareFile avec le type image/png', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { canShare: () => true, share });
    const outcome = await shareImage(new Blob(['x'], { type: 'image/png' }), 'seance.png', {});
    expect(outcome).toBe('shared');
    const [[{ files }]] = share.mock.calls;
    expect(files[0].type).toBe('image/png');
  });
});
