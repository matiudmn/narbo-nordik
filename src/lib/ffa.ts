export interface FFACategory {
  code: string;
  label: string;
}

const FFA_TABLE: { maxAge: number; code: string; label: string }[] = [
  { maxAge: 6,  code: 'BB', label: 'Baby Athle' },
  { maxAge: 9,  code: 'EA', label: 'Eveil Athletique' },
  { maxAge: 11, code: 'PO', label: 'Poussin(e)' },
  { maxAge: 13, code: 'BE', label: 'Benjamin(e)' },
  { maxAge: 15, code: 'MI', label: 'Minime' },
  { maxAge: 17, code: 'CA', label: 'Cadet(te)' },
  { maxAge: 19, code: 'JU', label: 'Junior' },
  { maxAge: 22, code: 'ES', label: 'Espoir' },
  { maxAge: 34, code: 'SE', label: 'Senior' },
  { maxAge: 39, code: 'M0', label: 'Master 0' },
  { maxAge: 44, code: 'M1', label: 'Master 1' },
  { maxAge: 49, code: 'M2', label: 'Master 2' },
  { maxAge: 54, code: 'M3', label: 'Master 3' },
  { maxAge: 59, code: 'M4', label: 'Master 4' },
  { maxAge: 64, code: 'M5', label: 'Master 5' },
  { maxAge: 69, code: 'M6', label: 'Master 6' },
  { maxAge: 74, code: 'M7', label: 'Master 7' },
  { maxAge: 79, code: 'M8', label: 'Master 8' },
  { maxAge: 84, code: 'M9', label: 'Master 9' },
  { maxAge: Infinity, code: 'M10', label: 'Master 10' },
];

export function getFFACategory(birthDate: string): FFACategory {
  const birthYear = new Date(birthDate).getFullYear();
  const currentYear = new Date().getFullYear();
  const ageFFA = currentYear - birthYear;

  for (const entry of FFA_TABLE) {
    if (ageFFA <= entry.maxAge) {
      return { code: entry.code, label: entry.label };
    }
  }
  return { code: 'M10', label: 'Master 10' };
}

export function formatBirthDatePublic(birthDate: string): string {
  const d = new Date(birthDate);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}
