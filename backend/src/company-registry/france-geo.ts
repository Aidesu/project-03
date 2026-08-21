/**
 * French department -> region code mapping (INSEE COG, post-2016 reform).
 * Stable public administrative data — not tied to any external API version.
 */
const DEPARTMENT_TO_REGION: Record<string, string> = {
  // Auvergne-Rhône-Alpes (84)
  '01': '84',
  '03': '84',
  '07': '84',
  '15': '84',
  '26': '84',
  '38': '84',
  '42': '84',
  '43': '84',
  '63': '84',
  '69': '84',
  '73': '84',
  '74': '84',
  // Bourgogne-Franche-Comté (27)
  '21': '27',
  '25': '27',
  '39': '27',
  '58': '27',
  '70': '27',
  '71': '27',
  '89': '27',
  '90': '27',
  // Bretagne (53)
  '22': '53',
  '29': '53',
  '35': '53',
  '56': '53',
  // Centre-Val de Loire (24)
  '18': '24',
  '28': '24',
  '36': '24',
  '37': '24',
  '41': '24',
  '45': '24',
  // Corse (94)
  '2A': '94',
  '2B': '94',
  // Grand Est (44)
  '08': '44',
  '10': '44',
  '51': '44',
  '52': '44',
  '54': '44',
  '55': '44',
  '57': '44',
  '67': '44',
  '68': '44',
  '88': '44',
  // Hauts-de-France (32)
  '02': '32',
  '59': '32',
  '60': '32',
  '62': '32',
  '80': '32',
  // Île-de-France (11)
  '75': '11',
  '77': '11',
  '78': '11',
  '91': '11',
  '92': '11',
  '93': '11',
  '94': '11',
  '95': '11',
  // Normandie (28)
  '14': '28',
  '27': '28',
  '50': '28',
  '61': '28',
  '76': '28',
  // Nouvelle-Aquitaine (75)
  '16': '75',
  '17': '75',
  '19': '75',
  '23': '75',
  '24': '75',
  '33': '75',
  '40': '75',
  '47': '75',
  '64': '75',
  '79': '75',
  '86': '75',
  '87': '75',
  // Occitanie (76)
  '09': '76',
  '11': '76',
  '12': '76',
  '30': '76',
  '31': '76',
  '32': '76',
  '34': '76',
  '46': '76',
  '48': '76',
  '65': '76',
  '66': '76',
  '81': '76',
  '82': '76',
  // Pays de la Loire (52)
  '44': '52',
  '49': '52',
  '53': '52',
  '72': '52',
  '85': '52',
  // Provence-Alpes-Côte d'Azur (93)
  '04': '93',
  '05': '93',
  '06': '93',
  '13': '93',
  '83': '93',
  '84': '93',
  // Overseas regions
  '971': '01', // Guadeloupe
  '972': '02', // Martinique
  '973': '03', // Guyane
  '974': '04', // La Réunion
  '976': '06', // Mayotte
};

/** First 2 chars of a commune/postal code, except the 3-digit overseas codes. */
export function departmentCodeFromCommune(
  codeCommuneInsee: string,
): string | undefined {
  if (!codeCommuneInsee) return undefined;
  if (codeCommuneInsee.startsWith('97') || codeCommuneInsee.startsWith('98')) {
    return codeCommuneInsee.slice(0, 3);
  }
  return codeCommuneInsee.slice(0, 2);
}

export function regionCodeFromDepartment(
  departmentCode: string | undefined,
): string | undefined {
  if (!departmentCode) return undefined;
  return DEPARTMENT_TO_REGION[departmentCode];
}
