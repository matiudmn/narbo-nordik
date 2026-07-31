# Backfill des avatars base64 vers le bucket `avatars`

Procédure documentée pour migrer plus tard les photos de profil historiques
(stockées en base64 dans `users.photo_url`) vers le bucket Storage `avatars`
(migration `supabase/migrations/20260731100000_avatars_bucket.sql`).

**Non exécutée.** Les nouveaux uploads (via `updateUserPhoto` dans
`DataContext`) passent déjà par le bucket ; ce script ne concerne que les
comptes dont la photo n'a pas été retouchée depuis le changement. Sans ce
backfill, ces profils continuent de fonctionner (`Avatar.tsx` affiche aussi
bien un `data:` qu'une URL), seul le gain de perf (poids transféré à chaque
`fetchAll`) reste différé pour eux.

## 1. Lister les utilisateurs concernés

Via MCP (`execute_sql`, lecture seule) ou SQL Editor Supabase :

```sql
select id, firstname, lastname, length(photo_url) as photo_bytes
from users
where photo_url like 'data:%'
order by length(photo_url) desc;
```

`photo_bytes` donne un ordre de grandeur du poids transféré par profil et par
login (un `data:image/jpeg;base64,...` de ~30-50 Ko n'est pas rare pour une
photo 200x200 en JPEG qualité 0.7).

## 2. Script de migration (esquisse, à adapter avant exécution)

Même style que les Edge Functions du projet (Deno + `@supabase/supabase-js`
via esm.sh), à lancer en local avec `deno run` (pas une Edge Function
déployée : accès direct à `SUPABASE_SERVICE_ROLE_KEY`, script one-shot).

```ts
// scripts/backfill-avatars.ts (à créer au moment de l'exécution)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const { data: users, error } = await supabase
  .from('users')
  .select('id, photo_url')
  .like('photo_url', 'data:%');

if (error) throw error;

for (const user of users ?? []) {
  const match = user.photo_url.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) {
    console.warn(`Skip ${user.id} : format data: inattendu`);
    continue;
  }
  const [, subtype, base64] = match;
  const ext = subtype === 'jpeg' ? 'jpg' : subtype;
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const filePath = `${user.id}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, bytes, { contentType: `image/${subtype}`, upsert: true });
  if (uploadError) {
    console.error(`Upload KO ${user.id} :`, uploadError.message);
    continue;
  }

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
  const { error: updateError } = await supabase
    .from('users')
    .update({ photo_url: `${urlData.publicUrl}?t=${Date.now()}` })
    .eq('id', user.id);
  if (updateError) console.error(`Update KO ${user.id} :`, updateError.message);
  else console.log(`OK ${user.id}`);
}
```

Équivalent Node (si Deno pas disponible sur la machine d'exécution) : même
logique avec `@supabase/supabase-js` npm et `Buffer.from(base64, 'base64')`
à la place de `atob` / `Uint8Array`.

## 3. Avant de lancer pour de vrai

- Faire tourner sur un petit lot d'abord (`.limit(3)` sur la requête `select`)
  et vérifier visuellement 2-3 avatars migrés dans l'app.
- `SUPABASE_SERVICE_ROLE_KEY` ne doit jamais être committée : variable d'env
  locale uniquement, jamais dans ce dépôt.
- Le script est idempotent par construction (`upsert: true` côté storage,
  `update` reste sans effet si déjà migré) : relançable sans risque en cas
  d'interruption partielle.
- Ne pas supprimer `photo_url` des lignes non `data:%` (déjà migrées ou déjà
  vides) : le `.like('photo_url', 'data:%')` du `select` initial les exclut
  déjà.
