import { defineConfig } from 'vitest/config';

// Config dédiée aux tests unitaires des libs pures (pas de DOM nécessaire).
// Les tests de composants React (jsdom + Testing Library) pourront être
// ajoutés plus tard avec un environnement 'jsdom'.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    globals: false,
  },
});
