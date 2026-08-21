// Plain-text {{variable}} interpolation for email templates. Deliberately not
// HTML — templates are copied straight into the user's mail client, and
// keeping everything as text means there is no rendering/XSS surface here.

import { TranslationKey } from './i18n';

export interface TemplateVars {
  poste?: string | null;
  entreprise?: string | null;
  contact_prenom?: string | null;
  contact_nom?: string | null;
  mon_nom?: string | null;
}

/**
 * The `{{token}}` names are user-content syntax stored in saved templates —
 * translating them would break every template already written, so only the
 * description is localized.
 */
export const TEMPLATE_VARIABLE_HINTS = [
  { token: '{{poste}}', descriptionKey: 'templateVar.poste' },
  { token: '{{entreprise}}', descriptionKey: 'templateVar.entreprise' },
  { token: '{{contact_prenom}}', descriptionKey: 'templateVar.contact_prenom' },
  { token: '{{contact_nom}}', descriptionKey: 'templateVar.contact_nom' },
  { token: '{{mon_nom}}', descriptionKey: 'templateVar.mon_nom' },
] satisfies { token: string; descriptionKey: TranslationKey }[];

/** The two halves of a template, copied one at a time. */
export type TemplatePart = 'subject' | 'body';

/**
 * Clipboard slot for one half of one template. Carries the template id so the
 * "Copied ✓" confirmation lands on the button that was clicked, and so two
 * pages copying a subject cannot confirm on each other's button.
 */
export function slotFor(templateId: string, part: TemplatePart): string {
  return `template:${templateId}:${part}`;
}

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
