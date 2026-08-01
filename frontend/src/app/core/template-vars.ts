// Plain-text {{variable}} interpolation for email templates. Deliberately not
// HTML — templates are copied straight into the user's mail client, and
// keeping everything as text means there is no rendering/XSS surface here.

export interface TemplateVars {
  poste?: string | null;
  entreprise?: string | null;
  contact_prenom?: string | null;
  contact_nom?: string | null;
  mon_nom?: string | null;
}

export const TEMPLATE_VARIABLE_HINTS: { token: string; description: string }[] = [
  { token: '{{poste}}', description: 'Intitulé du poste' },
  { token: '{{entreprise}}', description: "Nom de l'entreprise" },
  { token: '{{contact_prenom}}', description: 'Prénom du contact' },
  { token: '{{contact_nom}}', description: 'Nom du contact' },
  { token: '{{mon_nom}}', description: 'Ton nom' },
];

const KNOWN_KEYS = new Set<keyof TemplateVars>([
  'poste',
  'entreprise',
  'contact_prenom',
  'contact_nom',
  'mon_nom',
]);

const TOKEN_PATTERN = /{{\s*(\w+)\s*}}/g;

/**
 * Replaces known `{{key}}` tokens with the matching value (or '' when the
 * value is missing). Unknown tokens are left untouched so a typo in a
 * template is visible instead of silently disappearing.
 */
export function renderTemplate(text: string, vars: TemplateVars): string {
  return text.replace(TOKEN_PATTERN, (match, key: string) => {
    if (!KNOWN_KEYS.has(key as keyof TemplateVars)) return match;
    return vars[key as keyof TemplateVars] || '';
  });
}
