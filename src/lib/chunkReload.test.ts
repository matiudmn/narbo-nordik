import { describe, it, expect } from 'vitest';
import { isChunkLoadError } from './chunkReload';

describe('isChunkLoadError', () => {
  it('détecte le message Chrome / Edge', () => {
    const err = new Error(
      'Failed to fetch dynamically imported module: https://narbo-nordik.vercel.app/assets/Settings-abc123.js',
    );
    expect(isChunkLoadError(err)).toBe(true);
  });

  it('détecte le message Firefox', () => {
    const err = new Error(
      'error loading dynamically imported module: https://narbo-nordik.vercel.app/assets/Settings-abc123.js',
    );
    expect(isChunkLoadError(err)).toBe(true);
  });

  it('détecte le message Safari', () => {
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true);
  });

  it("détecte l'échec de préchargement CSS", () => {
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/Settings-abc123.css'))).toBe(
      true,
    );
  });

  it('accepte une erreur passée sous forme de chaîne', () => {
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(true);
  });

  it('ignore une erreur runtime classique', () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(
      false,
    );
  });

  it('ignore null, undefined et les objets vides', () => {
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError({})).toBe(false);
    expect(isChunkLoadError(new Error(''))).toBe(false);
  });
});
