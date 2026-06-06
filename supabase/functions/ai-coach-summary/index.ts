// Résumé hebdo coach (P1 IA). Agnostique au provider : API compatible OpenAI,
// paramétrée par AI_BASE_URL / AI_MODEL / clé. Par défaut Mistral (UE, RGPD).
// Le client (Dashboard coach) envoie un payload compact de la semaine ; la
// fonction appelle le LLM et renvoie un résumé texte. Aucune donnée stockée.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AI_API_KEY = Deno.env.get('MISTRAL_API_KEY') ?? Deno.env.get('AI_API_KEY');
const AI_BASE_URL = Deno.env.get('AI_BASE_URL') ?? 'https://api.mistral.ai/v1';
const AI_MODEL = Deno.env.get('AI_MODEL') ?? 'mistral-small-latest';

const SYSTEM = `Tu es l'assistant du coach d'un club de course à pied et trail amateur (Narbo Nordik). À partir des données de la semaine fournies (par athlète : nombre de séances réalisées, sensations, retours libres), produis un résumé en français, concis (5 à 8 lignes), au ton bienveillant et factuel, qui fait gagner du temps au coach. Mets en avant : qui semble décrocher ou en difficulté (sensations mauvaises, peu de séances, aucun retour), qui est en forme, et 1 ou 2 retours marquants. Termine par une courte liste "À recontacter" si pertinent. Règles strictes : aucun conseil médical ni diagnostic, n'invente aucune donnée, pas de remplissage inutile.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!AI_API_KEY) return json({ error: 'IA non configurée (secret MISTRAL_API_KEY manquant).' }, 503);

  let week: unknown;
  try {
    const body = await req.json();
    week = body?.week;
  } catch {
    return json({ error: 'Corps de requête invalide.' }, 400);
  }
  if (!week || (Array.isArray(week) && week.length === 0)) {
    return json({ error: 'Aucune donnée de semaine à résumer.' }, 400);
  }

  try {
    const r = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.3,
        max_tokens: 600,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Données de la semaine (JSON, un objet par athlète) :\n${JSON.stringify(week)}` },
        ],
      }),
    });
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 300);
      return json({ error: `Fournisseur IA: HTTP ${r.status}`, detail }, 502);
    }
    const data = await r.json();
    const summary = data?.choices?.[0]?.message?.content ?? '';
    if (!summary) return json({ error: 'Réponse IA vide.' }, 502);
    return json({ summary, model: AI_MODEL });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
