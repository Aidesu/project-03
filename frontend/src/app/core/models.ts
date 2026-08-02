// Shared API types — kept in sync with the NestJS/Prisma backend.

export type Role = 'USER' | 'ADMIN';

export interface User {
  /** Opaque server-side identifier (uuid) — never a sequential number. */
  id: string;
  email: string;
  /** False until the address has been confirmed by clicking the mailed link. */
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
  role: Role;
  /** Mirrors UserSettings so the UI can pick its language on the first paint. */
  locale: string;
  /** IANA zone; every timestamp below is UTC and rendered through it. */
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  locale: string;
  timezone: string;
  weeklyApplicationGoal: number;
  emailRemindersEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---- Applications -------------------------------------------------------

export type ApplicationStatus =
  | 'WISHLIST'
  | 'DRAFT'
  | 'APPLIED'
  | 'SCREENING'
  | 'INTERVIEW'
  | 'TECHNICAL_TEST'
  | 'OFFER'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'GHOSTED';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

export type WorkMode = 'ON_SITE' | 'HYBRID' | 'REMOTE';

export type EmploymentType =
  | 'FULL_TIME'
  | 'PART_TIME'
  | 'CONTRACT'
  | 'INTERNSHIP'
  | 'APPRENTICESHIP'
  | 'FREELANCE'
  | 'TEMPORARY';

export type ApplicationSource =
  | 'JOB_BOARD'
  | 'LINKEDIN'
  | 'COMPANY_WEBSITE'
  | 'REFERRAL'
  | 'RECRUITER'
  | 'CAREER_FAIR'
  | 'SPONTANEOUS'
  | 'OTHER';

export type SalaryPeriod = 'HOUR' | 'DAY' | 'MONTH' | 'YEAR';

export interface TagRef {
  tag: { id: string; name: string; color: string | null };
}

/** Shape returned by `GET /api/applications` (list include). */
export interface ApplicationListItem {
  id: string;
  position: string;
  companyName: string | null;
  company: { id: string; name: string; logoUrl: string | null } | null;
  status: ApplicationStatus;
  priority: Priority;
  location: string | null;
  isFavorite: boolean;
  appliedAt: string | null;
  deadlineAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags: TagRef[];
  _count: { interviews: number };
}

export interface StatusEvent {
  id: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  note: string | null;
  createdAt: string;
}

export interface InterviewItem {
  id: string;
  type: string;
  mode: string | null;
  scheduledAt: string | null;
  durationMinutes: number | null;
  location: string | null;
  outcome: string;
  notes: string | null;
}

export interface CompanyRef {
  id: string;
  name: string;
  logoUrl: string | null;
  website: string | null;
  industry: string | null;
  location: string | null;
}

export interface ContactRef {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
}

/** Shape returned by `GET /api/applications/:id` (detail include). */
export interface ApplicationDetail {
  id: string;
  position: string;
  companyName: string | null;
  company: CompanyRef | null;
  description: string | null;
  status: ApplicationStatus;
  source: ApplicationSource | null;
  jobUrl: string | null;
  location: string | null;
  workMode: WorkMode | null;
  employmentType: EmploymentType | null;
  priority: Priority;
  excitement: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: SalaryPeriod;
  appliedAt: string | null;
  deadlineAt: string | null;
  closedAt: string | null;
  notes: string | null;
  isFavorite: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  primaryContact: ContactRef | null;
  tags: TagRef[];
  interviews: InterviewItem[];
  statusHistory: StatusEvent[];
  _count: { documents: number; reminders: number };
}

// ---- Gamification -------------------------------------------------------

export interface XpEvent {
  id: string;
  amount: number;
  reason: string;
  description: string | null;
  createdAt: string;
}

/** Shape returned by `GET /api/gamification/me`. */
export interface GamificationProfile {
  xp: number;
  level: number;
  currentStreakDays: number;
  longestStreakDays: number;
  lastActiveOn: string | null;
  xpIntoLevel: number;
  xpForNextLevel: number;
  recentXp: XpEvent[];
}

/** Shape returned by `GET /api/gamification/achievements`. */
export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string | null;
  xpReward: number;
  threshold: number;
  progress: number;
  unlockedAt: string | null;
}

/** Shape returned by `GET /api/applications/stats/daily` — oldest first. */
export interface DailyApplicationStat {
  date: string;
  count: number;
}

// ---- Email templates ------------------------------------------------------

export type EmailTemplateCategory =
  | 'FOLLOW_UP'
  | 'THANK_YOU'
  | 'COLD_OUTREACH'
  | 'OFFER_NEGOTIATION'
  | 'WITHDRAWAL'
  | 'OTHER';

export interface EmailTemplate {
  id: string;
  category: EmailTemplateCategory;
  name: string;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

// ---- Network: companies & contacts ---------------------------------------
//
// Every shape below is strictly private to the signed-in user: the API scopes
// each read and write by userId, and nothing here is shared across accounts.

/** Shape returned by `GET /api/companies` (list include). */
export interface CompanyListItem {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  size: string | null;
  logoUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { applications: number; contacts: number };
}

/** Shape returned by `GET /api/companies/:id` (detail include). */
export interface CompanyDetail extends CompanyListItem {
  contacts: Contact[];
  applications: {
    id: string;
    position: string;
    status: ApplicationStatus;
    appliedAt: string | null;
    updatedAt: string;
  }[];
}

/** The `company` sub-object embedded in contact responses. */
export interface ContactCompanyRef {
  id: string;
  name: string;
  logoUrl: string | null;
}

/** Shape returned by `GET /api/contacts` (list include). */
export interface Contact {
  id: string;
  firstName: string;
  lastName: string | null;
  companyId: string | null;
  company?: ContactCompanyRef | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  linkedinUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Shape returned by `GET /api/contacts/:id` (detail include). */
export interface ContactDetail extends Contact {
  company: ContactCompanyRef | null;
  interviews: InterviewItem[];
  _count: { interviews: number; primaryForApplications: number };
}

// ---- Generic paginated envelope ----------------------------------------

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}
