#!/usr/bin/env bash
# Génère les livrables d'onboarding athlète à partir des gabarits versionnés.
#
# Le code d'invitation du club N'EST PAS versionné : ce dépôt est public, et ce code
# suffit à créer un compte athlète. Les gabarits portent donc {{CODE_INVITATION}}, et
# ce script y injecte la valeur réelle au moment de la génération. Les fichiers produits
# contiennent le code en clair et sont ignorés par git (voir .gitignore de ce dossier).
#
# Récupérer le code courant (lecture seule) :
#   select invite_code from public.club_settings;
#
# Usage :
#   CODE_INVITATION=XXXXXXXX ./build.sh
set -euo pipefail

cd "$(dirname "$0")"

if [[ -z "${CODE_INVITATION:-}" ]]; then
  echo "CODE_INVITATION manquant. Usage : CODE_INVITATION=XXXXXXXX ./build.sh" >&2
  exit 1
fi

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[[ -x "$CHROME" ]] || { echo "Google Chrome introuvable, requis pour le rendu PDF." >&2; exit 1; }

# Le message part tel quel dans WhatsApp : on ne garde que la version à copier,
# sans les notes internes du gabarit (tout ce qui suit le second separateur ---).
sed "s/{{CODE_INVITATION}}/$CODE_INVITATION/g" message-whatsapp-invitation.md \
  | awk '/^## Version à copier$/{f=1;next} /^## Notes d.usage$/{f=0} f' \
  | sed '/^---$/d' \
  | cat -s > message-whatsapp-invitation.txt

sed "s/{{CODE_INVITATION}}/$CODE_INVITATION/g" guide-demarrage-athlete.html > .guide.tmp.html
"$CHROME" --headless --disable-gpu --no-pdf-header-footer --allow-file-access-from-files \
  --print-to-pdf=guide-demarrage-athlete.pdf .guide.tmp.html 2>/dev/null
rm -f .guide.tmp.html

echo "Généré :"
echo "  guide-demarrage-athlete.pdf"
echo "  message-whatsapp-invitation.txt"
