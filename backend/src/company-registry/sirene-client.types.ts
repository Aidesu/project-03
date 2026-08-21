/**
 * Shapes for the INSEE Sirene API v3 "établissement" search response.
 *
 * VERIFY BEFORE PRODUCTION USE: field names, the exact response envelope,
 * and the pagination mechanism below are my best recollection of the SIRENE
 * v3 "établissement" endpoint, not a checked-today copy of the live schema.
 * Confirm against https://portail-api.insee.fr (Sirene API v3 documentation)
 * before relying on this mapping — INSEE has changed both the auth scheme
 * and response shape across versions in the past.
 */

export interface SireneEtablissement {
  siret: string;
  siren: string;
  uniteLegale?: {
    denominationUniteLegale?: string | null;
    nomUniteLegale?: string | null; // personne physique: family name
    prenom1UniteLegale?: string | null; // personne physique: first name
  };
  adresseEtablissement?: {
    numeroVoieEtablissement?: string | null;
    typeVoieEtablissement?: string | null;
    libelleVoieEtablissement?: string | null;
    codePostalEtablissement?: string | null;
    libelleCommuneEtablissement?: string | null;
    codeCommuneEtablissement?: string | null;
  };
  activitePrincipaleEtablissement?: string | null; // NAF/APE code
  etatAdministratifEtablissement?: 'A' | 'F' | null; // active / fermé
  dateDernierTraitementEtablissement?: string | null; // ISO date
  statutDiffusionEtablissement?: 'O' | 'P' | null; // O = diffusible, P = partiel (opt-out)
}

export interface SireneSearchResponse {
  header: {
    total: number;
    curseur: string;
    curseurSuivant?: string | null;
  };
  etablissements: SireneEtablissement[];
}

export interface SireneSearchParams {
  /** SIRENE query language, e.g. `codeCommuneEtablissement:75101 OR ...`. */
  q: string;
  /** Cursor for the next page; omit to start from the beginning ("*"). */
  curseur?: string;
  /** Page size — keep well under the API's per-request cap. */
  nombre?: number;
}
