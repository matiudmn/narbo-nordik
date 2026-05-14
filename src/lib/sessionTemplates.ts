/**
 * Helpers pour la bibliothèque de templates de séances (côté coach).
 *
 *  - fetchTemplates() : récupère la bibliothèque triée par usage + nom
 *  - instantiateTemplate() : transforme un template en draft de séance
 *    avec nouveaux IDs de blocs, applicable au form SessionEditor
 *  - saveTemplate() : sauvegarde une séance en cours comme template
 *  - deleteTemplate() : suppression (templates non-seed uniquement)
 *  - incrementUsage() : appelée après instanciation pour le tri
 */

import { supabase } from './supabase';
import type { SessionTemplate, SessionBlock, TemplateCategory } from '../types';

let templateBlockIdCounter = 0;
function newBlockId(): string {
  return `blk_tpl_${Date.now()}_${templateBlockIdCounter++}`;
}

export async function fetchTemplates(): Promise<SessionTemplate[]> {
  const { data, error } = await supabase
    .from('session_templates')
    .select('*')
    .order('usage_count', { ascending: false })
    .order('name', { ascending: true });

  if (error) {
    console.error('fetchTemplates error:', error.message);
    return [];
  }
  return (data ?? []) as SessionTemplate[];
}

export interface InstantiatedTemplate {
  title: string;
  description: string | null;
  session_type: SessionTemplate['session_type'];
  terrain_options: SessionTemplate['terrain_options'];
  blocks: SessionBlock[];
}

/**
 * Transforme un template en draft de séance (sans date ni groupe — ceux-ci
 * sont à remplir par le coach dans le form).
 * Régénère les IDs de blocs pour éviter les collisions.
 */
export function instantiateTemplate(template: SessionTemplate): InstantiatedTemplate {
  return {
    title: template.name,
    description: template.description,
    session_type: template.session_type,
    terrain_options: [...template.terrain_options],
    blocks: template.blocks.map((b) => ({ ...b, id: newBlockId() })),
  };
}

/**
 * Sauvegarde une séance en cours comme nouveau template.
 * Retourne l'id du template créé, ou null en cas d'erreur.
 */
export async function saveTemplate(
  template: Omit<SessionTemplate, 'id' | 'is_seed' | 'usage_count' | 'created_at'>
): Promise<string | null> {
  const { data, error } = await supabase
    .from('session_templates')
    .insert({
      name: template.name,
      description: template.description,
      category: template.category,
      session_type: template.session_type,
      terrain_options: template.terrain_options,
      blocks: template.blocks,
      is_seed: false,
      created_by: template.created_by,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('saveTemplate error:', error?.message);
    return null;
  }
  return data.id;
}

export async function deleteTemplate(templateId: string): Promise<boolean> {
  const { error } = await supabase.from('session_templates').delete().eq('id', templateId);
  if (error) {
    console.error('deleteTemplate error:', error.message);
    return false;
  }
  return true;
}

export async function incrementUsage(templateId: string): Promise<void> {
  // Fire & forget — non bloquant pour l'UX
  await supabase.rpc('increment_template_usage', { template_id: templateId });
}

/* ------------------------------------------------------------
   Métadonnées d'affichage par catégorie
   ------------------------------------------------------------ */

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  vma: 'VMA',
  seuil: 'Seuil',
  endurance: 'Endurance',
  sortie_longue: 'Sortie longue',
  recup: 'Récupération',
  autre: 'Autre',
};

export const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  vma: 'var(--color-session-course)',         // orange
  seuil: 'var(--color-session-entrainement)', // bleu
  endurance: 'var(--color-session-sortie-longue)', // vert
  sortie_longue: 'var(--color-session-sortie-longue)',
  recup: 'var(--color-session-recuperation)',
  autre: 'var(--color-neutral-500)',
};
