// OCR de capture (P1 IA). L'athlète envoie une capture (montre Garmin/Coros/Suunto
// ou Strava) ; on extrait les métriques via un LLM vision (Mistral par défaut,
// agnostique provider via AI_BASE_URL / AI_VISION_MODEL). Sortie JSON bornée.
// Aucune image stockée : elle transite, l'extraction revient, rien n'est persisté.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AI_API_KEY = Deno.env.get('MISTRAL_API_KEY') ?? Deno.env.get('AI_API_KEY');
const AI_BASE_URL = Deno.env.get('AI_BASE_URL') ?? 'https://api.mistral.ai/v1';
const AI_VISION_MODEL = Deno.env.get('AI_VISION_MODEL') ?? Deno.env.get('AI_MODEL') ?? 'mistral-small-latest';

const SYSTEM = `Tu extrais les métriques d'une séance de course à pied ou trail depuis une capture d'écran (montre Garmin/Coros/Suunto ou appli Strava). Réponds UNIQUEMENT par un objet JSON avec ces clés (toutes optionnelles) :
{"distance_m": number|null, "duration_s": number|null, "elevation_m": number|null, "avg_hr": number|null, "max_hr": number|null}
Conversions : distance en MÈTRES (8,2 km -> 8200), durée en SECONDES (45:30 -> 2730 ; 1:05:00 -> 3900), dénivelé positif (D+) en mètres, fréquence cardiaque en bpm. Règle absolue : n'invente AUCUNE valeur. Si une métrique n'est pas clairement visible, mets null.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const clamp = (v: unknown, min: number, max: number): number | null =>
  (typeof v === 'number' && isFinite(v) && v >= min && v <= max) ? Math.round(v) : null;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!AI_API_KEY) return json({ error: 'IA non configurée (secret MISTRAL_API_KEY manquant).' }, 503);

  let image: unknown;
  try {
    image = (await req.json())?.image;
  } catch {
    return json({ error: 'Corps de requête invalide.' }, 400);
  }
  if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
    return json({ error: 'Image manquante ou invalide (data URI attendu).' }, 400);
  }
  if (image.length > 7_000_000) {
    return json({ error: 'Image trop volumineuse.' }, 413);
  }

  try {
    const r = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: AI_VISION_MODEL,
        temperature: 0,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Voici la capture de ma séance. Extrais les métriques en JSON.' },
              { type: 'image_url', image_url: image },
            ],
          },
        ],
      }),
    });
    if (!r.ok) {
      console.error('ai-ocr provider error', r.status, (await r.text()).slice(0, 300));
      return json({ error: 'Fournisseur IA indisponible.' }, 502);
    }
    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content ?? '{}';
    let m: Record<string, unknown>;
    try {
      m = JSON.parse(content);
    } catch {
      return json({ error: 'Réponse IA non parsable.' }, 502);
    }
    return json({
      metrics: {
        distance_m: clamp(m.distance_m, 0, 500000),
        duration_s: clamp(m.duration_s, 0, 540000),
        elevation_m: clamp(m.elevation_m, 0, 20000),
        avg_hr: clamp(m.avg_hr, 20, 260),
        max_hr: clamp(m.max_hr, 20, 260),
      },
      model: AI_VISION_MODEL,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
