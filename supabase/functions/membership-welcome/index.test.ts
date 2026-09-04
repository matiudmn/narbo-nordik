// Tests unitaires des fonctions pures de membership-welcome (lib.ts).
// Séparés d'index.ts comme pour membership-notify : ce dernier appelle serve()
// au chargement du module.
//
// Lancer : deno test --no-check supabase/functions/membership-welcome/index.test.ts
import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { buildWelcomeEmailHtml, escapeHtml, welcomeEmailSubject } from './lib.ts';

const member = { firstname: 'Léa', email: 'lea@example.org' };
const season = { season: '2026-2027', section: 'running_trail' };
const CODE = 'CODETEST';
const APP = 'https://narbo-nordik.vercel.app';

Deno.test('welcomeEmailSubject: annonce la validation et l app', () => {
  assertStringIncludes(welcomeEmailSubject(), 'validée');
  assertStringIncludes(welcomeEmailSubject(), 'appli');
});

Deno.test('buildWelcomeEmailHtml: porte le code d invitation, le lien et la saison', () => {
  const html = buildWelcomeEmailHtml(member, season, CODE, APP);
  assertStringIncludes(html, CODE);
  assertStringIncludes(html, `href="${APP}"`);
  assertStringIncludes(html, '2026-2027');
  assertStringIncludes(html, 'Léa');
});

Deno.test('buildWelcomeEmailHtml: insiste sur la meme adresse e-mail que l adhesion', () => {
  // C'est ce qui permet a link_member_to_user de relier le compte au dossier.
  const html = buildWelcomeEmailHtml(member, season, CODE, APP);
  assertStringIncludes(html, 'la même adresse e-mail que sur ta demande');
});

Deno.test('buildWelcomeEmailHtml: renvoie vers la page d installation', () => {
  const html = buildWelcomeEmailHtml(member, season, CODE, APP);
  assertStringIncludes(html, `${APP}/installer`);
});

Deno.test('buildWelcomeEmailHtml: pas de barre oblique doublee dans le lien d installation', () => {
  const html = buildWelcomeEmailHtml(member, season, CODE, `${APP}/`);
  assertStringIncludes(html, `${APP}/installer`);
  assert(!html.includes(`${APP}//installer`));
});

Deno.test('buildWelcomeEmailHtml: echappe le prenom et le code (donnees saisies au formulaire)', () => {
  const html = buildWelcomeEmailHtml(
    { firstname: '<script>alert(1)</script>', email: 'x@example.org' },
    season,
    '<b>X</b>',
    APP,
  );
  assert(!html.includes('<script>'));
  assert(!html.includes('<b>X</b>'));
  assertStringIncludes(html, '&lt;script&gt;');
});

Deno.test('escapeHtml: caracteres dangereux couverts', () => {
  assertEquals(escapeHtml(`<&">'`), '&lt;&amp;&quot;&gt;&#39;');
});
