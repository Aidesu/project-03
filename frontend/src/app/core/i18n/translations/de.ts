import { TranslationKey } from './en';

/**
 * German catalogue. Uses the informal "du" throughout, matching the French
 * original's tone. German runs noticeably longer than English — layouts must
 * not assume the English width.
 */
export const de: Record<TranslationKey, string> = {
  // ---- Common ----------------------------------------------------------
  'common.save': 'Speichern',
  'common.saveChanges': 'Änderungen speichern',
  'common.saving': 'Wird gespeichert…',
  'common.cancel': 'Abbrechen',
  'common.confirm': 'Bestätigen',
  'common.edit': 'Bearbeiten',
  'common.delete': 'Löschen',
  'common.deleting': 'Wird gelöscht…',
  'common.close': 'Schließen',
  'common.add': 'Hinzufügen',
  'common.search': 'Suchen',
  'common.previous': 'Zurück',
  'common.next': 'Weiter',
  'common.pageOf': 'Seite {page} / {pageCount}',
  'common.range': '{from}–{to} von {total}',
  'common.copySubject': 'Betreff kopieren',
  'common.copyMessage': 'Nachricht kopieren',
  'common.copied': 'Kopiert ✓',
  'common.optional': '(optional)',
  'common.notSet': 'Nicht angegeben',
  'common.applicationsCount':
    '{count, plural, one {# Bewerbung} other {# Bewerbungen}}',

  // ---- Language switcher ----------------------------------------------
  'language.label': 'Sprache',
  'language.ariaLabel': 'Sprache ändern',

  // ---- Navigation / shell ---------------------------------------------
  'nav.dashboard': 'Übersicht',
  'nav.applications': 'Bewerbungen',
  'nav.network': 'Netzwerk',
  'nav.emailTemplates': 'E-Mail-Vorlagen',
  'nav.progression': 'Fortschritt',
  'shell.logout': 'Abmelden',
  'shell.viewProfile': 'Profil ansehen',
  'shell.avatarAlt': 'Profilbild',

  // ---- Theme -----------------------------------------------------------
  'theme.label': 'Darstellung',
  'theme.light': 'Tageslicht',
  'theme.dark': 'Dämmerung',
  'theme.toggleAria': 'Zwischen Tageslicht und Dämmerung wechseln',
  'theme.followSystem': 'Meinem System folgen',
  'theme.followingSystem': 'Dein System entscheidet gerade.',

  // ---- Modal -----------------------------------------------------------
  'modal.close': 'Schließen',

  // ---- Auth (shared fields) -------------------------------------------
  'auth.email': 'E-Mail',
  'auth.emailPlaceholder': 'du@beispiel.de',
  'auth.password': 'Passwort',
  'auth.passwordPlaceholder': '••••••••••••',
  'auth.name': 'Name',
  'auth.namePlaceholder': 'Alex',

  // ---- Login -----------------------------------------------------------
  'login.heroTitle': 'Mach deine Jobsuche zur Quest.',
  'login.heroBody':
    'Verfolge deine Bewerbungen, sammle bei jedem Schritt XP und bleib mit täglichen Serien am Ball.',
  'login.heroFooter': 'Bleib dran. Hol dir den Job.',
  'login.title': 'Schön, dich wiederzusehen',
  'login.subtitle': 'Melde dich an und mach da weiter, wo du aufgehört hast.',
  'login.submit': 'Anmelden',
  'login.submitting': 'Anmeldung…',
  'login.noAccount': 'Noch kein Konto?',
  'login.createAccount': 'Konto erstellen',
  'login.invalidCredentials': 'E-Mail oder Passwort ist falsch.',
  'login.error': 'Anmeldung fehlgeschlagen. Versuch es gleich noch einmal.',

  // ---- Register --------------------------------------------------------
  'register.heroTitle': 'Starte deine Quest noch heute.',
  'register.heroBody':
    'Sammle jede Bewerbung an einem Ort, behalte deine Pipeline im Blick und steig Level für Level auf.',
  'register.heroFooter': 'Die Anmeldung dauert nur ein paar Sekunden.',
  'register.title': 'Konto erstellen',
  'register.subtitle': 'Kostenlos und schnell.',
  'register.nameOptional': '(optional)',
  'register.passwordPlaceholder': 'Mindestens {min} Zeichen',
  'register.passwordTooShort': 'Das Passwort muss mindestens {min} Zeichen lang sein.',
  'register.submit': 'Konto erstellen',
  'register.submitting': 'Wird erstellt…',
  'register.haveAccount': 'Schon ein Konto?',
  'register.signIn': 'Anmelden',
  'register.emailTaken': 'Mit dieser E-Mail-Adresse existiert bereits ein Konto.',
  'register.error':
    'Registrierung fehlgeschlagen. Prüfe deine Angaben und versuch es erneut.',

  // ---- Passwort vergessen & E-Mail-Bestätigung -------------------------
  'login.forgotPassword': 'Passwort vergessen?',
  'forgotPassword.title': 'Passwort vergessen?',
  'forgotPassword.subtitle':
    'Gib deine Adresse an und wir schicken dir einen Link für ein neues Passwort.',
  'forgotPassword.submit': 'Link senden',
  'forgotPassword.submitting': 'Wird gesendet…',
  'forgotPassword.sent':
    'Falls für diese Adresse ein Konto existiert, ist ein Link unterwegs. Er läuft in {minutes, plural, one {# Minute} other {# Minuten}} ab.',
  'forgotPassword.backToLogin': 'Zurück zur Anmeldung',
  'forgotPassword.error':
    'Da ist etwas schiefgelaufen. Versuch es gleich noch einmal.',
  'forgotPassword.tooMany':
    'Zu viele Versuche. Warte einen Moment, bevor du es erneut versuchst.',
  'resetPassword.title': 'Neues Passwort wählen',
  'resetPassword.subtitle': 'Dieser Link gilt einmal — und nicht lange.',
  'resetPassword.password': 'Neues Passwort',
  'resetPassword.confirm': 'Passwort bestätigen',
  'resetPassword.mismatch': 'Die beiden Passwörter stimmen nicht überein.',
  'resetPassword.submit': 'Passwort aktualisieren',
  'resetPassword.submitting': 'Wird aktualisiert…',
  'resetPassword.done':
    'Dein Passwort ist aktualisiert, und alle anderen Sitzungen wurden abgemeldet.',
  'resetPassword.signIn': 'Anmelden',
  'resetPassword.invalidLink': 'Dieser Link ist ungültig oder abgelaufen.',
  'resetPassword.missingToken': 'Dieser Link ist unvollständig.',
  'resetPassword.requestNew': 'Neuen Link anfordern',
  'resetPassword.error':
    'Das Passwort konnte nicht aktualisiert werden. Versuch es gleich noch einmal.',
  'verifyEmail.title': 'E-Mail-Bestätigung',
  'verifyEmail.checking': 'Deine Adresse wird bestätigt…',
  'verifyEmail.done':
    'Deine Adresse ist bestätigt. Du kannst dein Konto jetzt per E-Mail wiederherstellen.',
  'verifyEmail.invalid':
    'Dieser Link ist ungültig oder abgelaufen. Einen neuen kannst du in deinem Profil anfordern.',
  'verifyEmail.continue': 'Weiter',
  'emailBanner.text':
    'Bestätige deine E-Mail-Adresse, damit du dein Konto wiederherstellen kannst, falls du dein Passwort vergisst.',
  'emailBanner.resend': 'E-Mail erneut senden',
  'emailBanner.sending': 'Wird gesendet…',
  'emailBanner.sent': 'E-Mail gesendet — sieh in deinem Posteingang nach.',
  'emailBanner.error':
    'Die E-Mail konnte nicht gesendet werden. Versuch es gleich noch einmal.',
  'emailBanner.dismiss': 'Ausblenden',

  // ---- Dashboard -------------------------------------------------------
  'dashboard.greeting': 'Hallo {name} 👋',
  'dashboard.loadError': 'Dein Fortschritt kann gerade nicht geladen werden.',
  'dashboard.trend.title': 'Bewerbungen — letzte 7 Tage',
  'dashboard.trend.total':
    '{count, plural, one {# Bewerbung in diesem Zeitraum.} other {# Bewerbungen in diesem Zeitraum.}}',
  'dashboard.trend.empty':
    'Füge deine erste Bewerbung hinzu, um deinen Verlauf hier zu sehen.',
  'dashboard.trend.today': 'Heute',
  'dashboard.trend.vsYesterday': '{delta} ggü. gestern',
  'dashboard.chart.point':
    '{date}: {count, plural, one {# Bewerbung} other {# Bewerbungen}}',
  'dashboard.heatmap.title': 'Aktivität — letzte 12 Wochen',
  'dashboard.heatmap.less': 'Weniger',
  'dashboard.heatmap.more': 'Mehr',
  'dashboard.heatmap.cell':
    '{count, plural, one {# Bewerbung} other {# Bewerbungen}} — {date}',
  'dashboard.recent.title': 'Letzte Aktivität',
  'dashboard.recent.empty':
    'Noch keine XP. Füge deine erste Bewerbung hinzu und starte deine Quest!',

  // ---- XP reasons ------------------------------------------------------
  'xp.reason.APPLICATION_CREATED': 'Bewerbung angelegt',
  'xp.reason.APPLICATION_SUBMITTED': 'Bewerbung abgeschickt',
  'xp.reason.INTERVIEW_SCHEDULED': 'Gespräch geplant',
  'xp.reason.INTERVIEW_COMPLETED': 'Gespräch geführt',
  'xp.reason.OFFER_RECEIVED': 'Angebot erhalten',
  'xp.reason.OFFER_ACCEPTED': 'Angebot angenommen',
  'xp.reason.STREAK_BONUS': 'Serien-Bonus',
  'xp.reason.DAILY_GOAL': 'Tagesziel',
  'xp.reason.WEEKLY_GOAL': 'Wochenziel',
  'xp.reason.ACHIEVEMENT_UNLOCKED': 'Erfolg freigeschaltet',
  'xp.reason.APPLICATION_DELETED': 'Bewerbung gelöscht',
  'xp.reason.OTHER': 'Aktivität',

  // ---- Player card -----------------------------------------------------
  'playerCard.levelAndXp': 'Level {level} · {xp} XP insgesamt',
  'playerCard.level': 'Level',
  'playerCard.beforeNextLevel': 'bis Level {level}',
  'playerCard.streak': '{days, plural, one {# Tag} other {# Tage}} · Rekord {record}',
  'playerCard.achievements': 'Erfolge',

  // ---- Application statuses -------------------------------------------
  'status.WISHLIST': 'Merkliste',
  'status.DRAFT': 'Entwurf',
  'status.APPLIED': 'Beworben',
  'status.SCREENING': 'Vorauswahl',
  'status.INTERVIEW': 'Gespräch',
  'status.TECHNICAL_TEST': 'Technischer Test',
  'status.OFFER': 'Angebot',
  'status.ACCEPTED': 'Angenommen',
  'status.REJECTED': 'Abgelehnt',
  'status.WITHDRAWN': 'Zurückgezogen',
  'status.GHOSTED': 'Ohne Rückmeldung',

  // ---- Applications list ----------------------------------------------
  'applications.title': 'Bewerbungen',
  'applications.subtitle': 'Verfolge jede Gelegenheit durch die Pipeline.',
  'applications.new': 'Neue Bewerbung',

  // ---- Quick add -------------------------------------------------------
  'quickAdd.title': 'Schnell hinzufügen',
  'quickAdd.hint':
    'Nur die Stellenbezeichnung ist nötig — alles andere kann warten.',
  'quickAdd.saveAndDetails': 'Speichern und ergänzen',

  'applications.searchPlaceholder': 'Position oder Unternehmen suchen…',
  'applications.allStatuses': 'Alle Status',
  'applications.loadError': 'Die Bewerbungen können nicht geladen werden.',
  'applications.empty.title': 'Noch keine Bewerbung.',
  'applications.empty.body': 'Starte deine Quest mit deiner ersten Bewerbung.',
  'applications.unknownCompany': 'Unbekanntes Unternehmen',

  // ---- Application form -----------------------------------------------
  'applicationForm.back': 'Zurück',
  'applicationForm.backToList': 'Bewerbungen',
  'applicationForm.newTitle': 'Neue Bewerbung',
  'applicationForm.editTitle': 'Bewerbung bearbeiten',
  'applicationForm.section.essentials': 'Das Wichtigste',
  'applicationForm.section.optional': 'Optional',
  'applicationForm.legend.tracking': 'Verfolgung',
  'applicationForm.legend.salary': 'Vergütung',
  'applicationForm.legend.deadlineNotes': 'Frist & Notizen',
  'applicationForm.position': 'Stellenbezeichnung *',
  'applicationForm.positionPlaceholder': 'Frontend-Entwickler',
  'applicationForm.positionRequired': 'Die Stellenbezeichnung ist erforderlich.',
  'applicationForm.company': 'Unternehmen',
  'applicationForm.companyPlaceholder': 'Acme GmbH',
  'applicationForm.location': 'Ort',
  'applicationForm.locationPlaceholder': 'Berlin / Remote',
  'applicationForm.jobUrl': 'Link zur Stellenanzeige',
  'applicationForm.status': 'Status',
  'applicationForm.source': 'Quelle',
  'applicationForm.workMode': 'Arbeitsmodell',
  'applicationForm.employmentType': 'Vertragsart',
  'applicationForm.excitement': 'Interesse',
  'applicationForm.salaryMin': 'Min.',
  'applicationForm.salaryMax': 'Max.',
  'applicationForm.currency': 'Währung',
  'applicationForm.period': 'Zeitraum',
  'applicationForm.deadline': 'Frist',
  'applicationForm.notes': 'Notizen',
  'applicationForm.notesPlaceholder': 'Kontext, Ansprechpartner, Vorbereitung…',
  'applicationForm.notFound': 'Bewerbung nicht gefunden.',
  'applicationForm.salaryRangeError':
    'Das Mindestgehalt darf das Maximum nicht überschreiten.',
  'applicationForm.amountInvalid': 'Gib einen ganzzahligen Betrag ab 0 ein.',
  'applicationForm.currencyInvalid': 'Dreibuchstabiger Währungscode, z. B. EUR.',
  'applicationForm.notesTooLong': 'Notizen sind auf 5000 Zeichen begrenzt.',
  'applicationForm.invalidFields':
    'Einige Felder sind ungültig. Prüfe die URL und die Beträge.',
  'applicationForm.saveError':
    'Die Bewerbung konnte nicht gespeichert werden. Versuch es erneut.',

  // ---- Application detail ---------------------------------------------
  'applicationDetail.back': 'Bewerbungen',
  'applicationDetail.notFound': 'Bewerbung nicht gefunden.',
  'applicationDetail.website': 'Website',
  'applicationDetail.advance.title': 'Weiterbringen',
  'applicationDetail.advance.newStatus': 'Neuer Status',
  'applicationDetail.advance.note': 'Notiz (optional)',
  'applicationDetail.advance.notePlaceholder': 'z. B. beim Recruiter nachgefasst',
  'applicationDetail.advance.submit': 'Aktualisieren',
  'applicationDetail.email.title': 'E-Mail kopieren',
  'applicationDetail.email.empty': 'Noch keine Vorlage.',
  'applicationDetail.email.createFirst': 'Erstelle deine erste Vorlage',
  'applicationDetail.email.template': 'Vorlage',
  'applicationDetail.email.choose': '— Auswählen —',
  'applicationDetail.email.copyFailed':
    'Automatisches Kopieren fehlgeschlagen — markiere den Text manuell.',
  'applicationDetail.details.title': 'Details',
  'applicationDetail.details.location': 'Ort',
  'applicationDetail.details.workMode': 'Arbeitsmodell',
  'applicationDetail.details.employmentType': 'Vertragsart',
  'applicationDetail.details.source': 'Quelle',
  'applicationDetail.details.salary': 'Vergütung',
  'applicationDetail.details.excitement': 'Interesse',
  'applicationDetail.details.appliedAt': 'Beworben am',
  'applicationDetail.details.deadline': 'Frist',
  'applicationDetail.details.closedAt': 'Abgeschlossen am',
  'applicationDetail.details.notes': 'Notizen',
  'applicationDetail.history.title': 'Verlauf',
  'applicationDetail.danger.title': 'Gefahrenzone',
  'applicationDetail.danger.delete': 'Bewerbung löschen',
  'applicationDetail.danger.confirm.title': 'Diese Bewerbung löschen?',
  'applicationDetail.danger.confirm.body':
    'Ihre Gespräche, ihr Statusverlauf und ihre Erinnerungen werden mitgelöscht, und die damit verdienten XP werden wieder abgezogen. Freigeschaltete Erfolge bleiben erhalten.',

  // ---- Network ---------------------------------------------------------
  'network.title': 'Netzwerk',
  'network.subtitle': 'Deine Unternehmen und Kontakte — nur für dich sichtbar.',
  'network.newCompany': 'Neues Unternehmen',
  'network.newContact': 'Neuer Kontakt',
  'network.tabs.companies': 'Unternehmen',
  'network.tabs.contacts': 'Kontakte',
  'network.tabs.registry': 'Register',
  'network.searchCompanies': 'Unternehmen, Branche oder Stadt suchen…',
  'network.searchContacts': 'Name oder E-Mail suchen…',
  'network.searchRegistry': 'Unternehmensnamen suchen…',
  'network.loadError': 'Dein Netzwerk kann nicht geladen werden.',
  'network.companies.empty.title': 'Noch kein Unternehmen.',
  'network.companies.empty.body':
    'Füge die Unternehmen hinzu, die dich interessieren, und halte Notizen und Kontakte an einem Ort.',
  'network.contacts.empty.title': 'Noch kein Kontakt.',
  'network.contacts.empty.body':
    'Sammle hier die Recruiter und Menschen, die du während deiner Suche triffst.',
  'network.noIndustry': 'Branche nicht angegeben',
  'network.noRole': 'Rolle nicht angegeben',
  'network.companyApplications':
    '{count, plural, one {# Bewerbung} other {# Bewerbungen}}',
  'network.companyContacts': '{count, plural, one {# Kontakt} other {# Kontakte}}',
  'network.deleteCompanyAria': 'Unternehmen löschen',
  'network.deleteContactAria': 'Kontakt löschen',
  'network.confirmDeleteCompany.title': '„{name}“ löschen?',
  'network.confirmDeleteCompany.body':
    'Verknüpfte Bewerbungen und Kontakte bleiben erhalten, verlieren aber diese Verknüpfung.',
  'network.confirmDeleteContact.title': '„{name}“ löschen?',
  'network.confirmDeleteContact.body':
    'Bewerbungen, die auf diesen Kontakt verwiesen, bleiben erhalten, verlieren aber diese Verknüpfung.',
  'network.registry.empty.title': 'Kein Ergebnis.',
  'network.registry.empty.body': 'Versuche einen anderen Unternehmensnamen.',
  'network.registry.noAddress': 'Adresse nicht verfügbar',
  'network.registry.siret': 'SIRET {siret}',

  // ---- Company detail --------------------------------------------------
  'companyDetail.back': 'Netzwerk',
  'companyDetail.notFound': 'Unternehmen nicht gefunden.',
  'companyDetail.headcount': '{size} Mitarbeitende',
  'companyDetail.notes.title': 'Private Notizen',
  'companyDetail.contacts.title': 'Kontakte ({count})',
  'companyDetail.contacts.empty': 'Kein Kontakt mit diesem Unternehmen verknüpft.',
  'companyDetail.contacts.add': 'Hinzufügen',
  'companyDetail.applications.title': 'Bewerbungen ({count})',
  'companyDetail.applications.empty': 'Keine Bewerbung mit diesem Unternehmen verknüpft.',
  'companyDetail.appliedOn': 'Beworben am {date}',
  'companyDetail.notSentYet': 'Noch nicht abgeschickt',
  'companyDetail.confirmDelete.title': '„{name}“ löschen?',
  'companyDetail.confirmDelete.body':
    'Die {applications, plural, one {# verknüpfte Bewerbung} other {# verknüpften Bewerbungen}} und {contacts, plural, one {# verknüpfter Kontakt} other {# verknüpften Kontakte}} bleiben erhalten, verlieren aber diese Verknüpfung.',

  // ---- Contact detail --------------------------------------------------
  'contactDetail.back': 'Netzwerk',
  'contactDetail.notFound': 'Kontakt nicht gefunden.',
  'contactDetail.contactInfo': 'Kontaktdaten',
  'contactDetail.email': 'E-Mail',
  'contactDetail.phone': 'Telefon',
  'contactDetail.linkedin': 'LinkedIn',
  'contactDetail.notes.title': 'Private Notizen',
  'contactDetail.primaryFor':
    'Hauptkontakt bei {count, plural, one {# Bewerbung} other {# Bewerbungen}}.',

  // ---- Company form ----------------------------------------------------
  'companyForm.newTitle': 'Neues Unternehmen',
  'companyForm.editTitle': 'Unternehmen bearbeiten',
  'companyForm.name': 'Name *',
  'companyForm.namePlaceholder': 'z. B. Doctolib',
  'companyForm.nameRequired': 'Der Name ist erforderlich (max. 200 Zeichen).',
  'companyForm.website': 'Website',
  'companyForm.websitePlaceholder': 'doctolib.de',
  'companyForm.industry': 'Branche',
  'companyForm.industryPlaceholder': 'z. B. Gesundheit',
  'companyForm.city': 'Stadt',
  'companyForm.cityPlaceholder': 'z. B. Berlin',
  'companyForm.size': 'Mitarbeitendenzahl',
  'companyForm.sizeNone': 'Nicht angegeben',
  'companyForm.notes': 'Private Notizen',
  'companyForm.notesPlaceholder': 'Bewerbungsprozess, hilfreiche Kontakte, Eindruck…',
  'companyForm.notesHint': 'Nur für dich sichtbar.',
  'companyForm.invalidUrl':
    'Prüfe die Felder — die Website muss eine gültige URL sein.',
  'companyForm.saveError':
    'Das Unternehmen konnte nicht gespeichert werden. Versuch es erneut.',

  // ---- Contact form ----------------------------------------------------
  'contactForm.newTitle': 'Neuer Kontakt',
  'contactForm.editTitle': 'Kontakt bearbeiten',
  'contactForm.firstName': 'Vorname *',
  'contactForm.firstNamePlaceholder': 'z. B. Camille',
  'contactForm.firstNameRequired': 'Der Vorname ist erforderlich (max. 120 Zeichen).',
  'contactForm.lastName': 'Nachname',
  'contactForm.lastNamePlaceholder': 'z. B. Durand',
  'contactForm.role': 'Rolle',
  'contactForm.rolePlaceholder': 'z. B. Talent Acquisition',
  'contactForm.company': 'Unternehmen',
  'contactForm.companyNone': 'Keines',
  'contactForm.companiesTruncated': 'Nur die ersten 100 Unternehmen werden hier gelistet.',
  'contactForm.email': 'E-Mail',
  'contactForm.emailPlaceholder': 'camille@beispiel.de',
  'contactForm.emailInvalid': 'Ungültige E-Mail-Adresse.',
  'contactForm.phone': 'Telefon',
  'contactForm.phonePlaceholder': '+49 151 12345678',
  'contactForm.linkedin': 'LinkedIn',
  'contactForm.linkedinPlaceholder': 'linkedin.com/in/…',
  'contactForm.notes': 'Private Notizen',
  'contactForm.notesPlaceholder':
    'Wie ihr euch kennengelernt habt, besprochene Themen, geplantes Nachfassen…',
  'contactForm.notesHint': 'Nur für dich sichtbar.',
  'contactForm.invalidFields':
    'Prüfe die Felder — E-Mail und LinkedIn-URL müssen gültig sein.',
  'contactForm.saveError':
    'Der Kontakt konnte nicht gespeichert werden. Versuch es erneut.',

  // ---- Email templates -------------------------------------------------
  'emailTemplates.title': 'E-Mail-Vorlagen',
  'emailTemplates.subtitle': 'Einmal schreiben, mit einem Klick kopieren.',
  'emailTemplates.new': 'Neue Vorlage',
  'emailTemplates.form.newTitle': 'Neue Vorlage',
  'emailTemplates.form.editTitle': 'Vorlage bearbeiten',
  'emailTemplates.form.name': 'Name der Vorlage *',
  'emailTemplates.form.namePlaceholder': 'Nachfassen Recruiter T+7',
  'emailTemplates.form.nameError': 'Der Name ist erforderlich (max. 100 Zeichen).',
  'emailTemplates.form.category': 'Kategorie',
  'emailTemplates.form.subject': 'Betreff *',
  'emailTemplates.form.subjectPlaceholder':
    'Nach unserem Gespräch — {poste} bei {entreprise}',
  'emailTemplates.form.subjectError': 'Der Betreff ist erforderlich (max. 200 Zeichen).',
  'emailTemplates.form.body': 'Text *',
  'emailTemplates.form.bodyPlaceholder': 'Hallo {contact_prenom},',
  'emailTemplates.form.bodyError': 'Der Text ist erforderlich (max. 5000 Zeichen).',
  'emailTemplates.form.variables':
    'Verfügbare Variablen — werden beim Kopieren aus einer Bewerbung automatisch ersetzt:',
  'emailTemplates.loadError': 'Die Vorlagen können nicht geladen werden.',
  'emailTemplates.saveError':
    'Die Vorlage konnte nicht gespeichert werden. Versuch es erneut.',
  'emailTemplates.copyError':
    'Automatisches Kopieren fehlgeschlagen — markiere den Text manuell.',
  'emailTemplates.empty.title': 'Noch keine Vorlage.',
  'emailTemplates.empty.body':
    'Erstelle deine erste Vorlage zum Nachfassen oder Bedanken.',
  'emailTemplates.confirmDelete.title': '„{name}“ löschen?',
  'emailTemplates.confirmDelete.body':
    'Diese Vorlage wird endgültig entfernt. Sonst ändert sich nichts.',

  'templateVar.poste': 'Stellenbezeichnung',
  'templateVar.entreprise': 'Name des Unternehmens',
  'templateVar.contact_prenom': 'Vorname des Kontakts',
  'templateVar.contact_nom': 'Nachname des Kontakts',
  'templateVar.mon_nom': 'Dein Name',

  // ---- Progress --------------------------------------------------------
  'progression.overline': 'Fortschritt',
  'progression.title': 'Deine Quest auf einen Blick',
  'progression.subtitle': 'Level, Serien und unterwegs freigeschaltete Erfolge.',
  'progression.loadError': 'Dein Fortschritt kann gerade nicht geladen werden.',
  'progression.streakNone':
    'Füge heute eine Bewerbung hinzu, um eine Serie zu starten.',
  'progression.streakActive': 'Serie läuft — mach genau so weiter.',
  'progression.achievements.title': 'Erfolge',
  'progression.achievements.count': '{unlocked} / {total} freigeschaltet',
  'progression.unlockedOn': 'Freigeschaltet am {date}',
  'progression.achievement.unlockedAria':
    'Erfolg freigeschaltet: {name}, erhalten am {date}',
  'progression.achievement.lockedAria':
    'Erfolg gesperrt: {name}, {progress} von {threshold}',
  'achievementCategory.applications': 'Bewerbungen',
  'achievementCategory.offers': 'Angebote',
  'achievementCategory.discipline': 'Disziplin',
  'achievementCategory.level': 'Level',

  'achievement.FIRST_APPLICATION.name': 'Erster Schritt',
  'achievement.FIRST_APPLICATION.description': 'Füge deine allererste Bewerbung hinzu.',
  'achievement.TEN_APPLICATIONS.name': 'Mittendrin',
  'achievement.TEN_APPLICATIONS.description': 'Erreiche 10 Bewerbungen.',
  'achievement.TWENTY_FIVE_APPLICATIONS.name': 'Ausdauer',
  'achievement.TWENTY_FIVE_APPLICATIONS.description': 'Erreiche 25 Bewerbungen.',
  'achievement.FIRST_OFFER.name': 'Erstes Angebot',
  'achievement.FIRST_OFFER.description': 'Erhalte dein erstes Angebot.',
  'achievement.OFFER_ACCEPTED.name': 'Ziel erreicht',
  'achievement.OFFER_ACCEPTED.description': 'Nimm ein Angebot an.',
  'achievement.STREAK_7.name': 'Eine Woche am Stück',
  'achievement.STREAK_7.description': 'Bleib 7 Tage in Folge aktiv.',
  'achievement.STREAK_30.name': 'Ein Monat Disziplin',
  'achievement.STREAK_30.description': 'Bleib 30 Tage in Folge aktiv.',
  'achievement.LEVEL_5.name': 'Level 5',
  'achievement.LEVEL_5.description': 'Erreiche Level 5.',
  'achievement.LEVEL_10.name': 'Level 10',
  'achievement.LEVEL_10.description': 'Erreiche Level 10.',

  // ---- Profile ---------------------------------------------------------
  'profile.title': 'Mein Profil',
  'profile.subtitle': 'Verwalte dein Konto, deine Sicherheit und deine Einstellungen.',
  'profile.avatar.title': 'Profilbild',
  'profile.avatar.change': 'Bild ändern',
  'profile.avatar.uploading': 'Wird hochgeladen…',
  'profile.avatar.remove': 'Entfernen',
  'profile.avatar.hint': 'JPEG, PNG oder WebP — maximal 2 MB.',
  'profile.avatar.badType': 'Zulässige Formate: JPEG, PNG, WebP.',
  'profile.avatar.tooLarge': 'Bild zu groß (maximal 2 MB).',
  'profile.avatar.uploadFailed':
    'Upload fehlgeschlagen — prüfe, ob es sich um ein gültiges Bild handelt.',
  'profile.avatar.removeFailed': 'Das Bild konnte nicht entfernt werden.',
  'profile.account.title': 'Kontoinformationen',
  'profile.account.name': 'Name',
  'profile.account.email': 'E-Mail',
  'profile.account.emailInvalid': 'Ungültige E-Mail-Adresse.',
  'profile.account.currentPassword': 'Aktuelles Passwort',
  'profile.account.currentPasswordHint': '(zum Ändern der E-Mail erforderlich)',
  'profile.account.success': 'Informationen aktualisiert.',
  'profile.account.passwordRequiredForEmail':
    'Zum Ändern der E-Mail-Adresse ist das aktuelle Passwort erforderlich.',
  'profile.account.wrongPassword': 'Das aktuelle Passwort ist falsch.',
  'profile.account.emailTaken': 'Diese E-Mail-Adresse wird bereits verwendet.',
  'profile.account.saveError':
    'Die Änderungen konnten nicht gespeichert werden. Versuch es erneut.',
  'profile.password.title': 'Passwort',
  'profile.password.current': 'Aktuelles Passwort',
  'profile.password.new': 'Neues Passwort',
  'profile.password.newPlaceholder': 'Mindestens {min} Zeichen',
  'profile.password.minError': 'Mindestens {min} Zeichen.',
  'profile.password.confirm': 'Passwort bestätigen',
  'profile.password.mismatch': 'Die Passwörter stimmen nicht überein.',
  'profile.password.success':
    'Passwort geändert. Deine anderen Sitzungen wurden abgemeldet.',
  'profile.password.submit': 'Passwort ändern',
  'profile.password.submitting': 'Wird geändert…',
  'profile.password.sameAsCurrent':
    'Das neue Passwort muss sich vom aktuellen unterscheiden.',
  'profile.password.error':
    'Das Passwort konnte nicht geändert werden. Versuch es erneut.',
  'profile.settings.title': 'Einstellungen',
  'profile.settings.language': 'Sprache',
  'profile.settings.timezone': 'Zeitzone',
  'profile.settings.weeklyGoal': 'Wochenziel an Bewerbungen',
  'profile.settings.emailReminders': 'Erinnerungen per E-Mail erhalten',
  'profile.settings.success': 'Einstellungen gespeichert.',
  'profile.settings.loadError': 'Die Einstellungen konnten nicht geladen werden.',
  'profile.settings.saveError':
    'Die Einstellungen konnten nicht gespeichert werden. Versuch es erneut.',
  'profile.privacy.title': 'Ihre Daten',
  'profile.privacy.body':
    'Laden Sie alles herunter, was dieses Konto enthält — Bewerbungen, Unternehmen, Kontakte, Erinnerungen, Vorlagen, Fortschritt und Sicherheitsverlauf — in einer einzigen JSON-Datei. Das Anfordern einer Kopie löscht nichts.',
  'profile.privacy.export': 'Meine Daten herunterladen',
  'profile.privacy.exporting': 'Ihre Datei wird vorbereitet…',
  'profile.privacy.error':
    'Ihr Export konnte nicht vorbereitet werden. Bitte versuchen Sie es erneut.',
  'profile.privacy.tooMany':
    'Zu viele Exporte angefordert. Bitte warten Sie einen Moment, bevor Sie es erneut versuchen.',
  'profile.sessions.title': 'Aktive Sitzungen',
  'profile.sessions.body':
    'Die Geräte, die derzeit in Ihrem Konto angemeldet sind. Wenn Sie eines nicht erkennen, melden Sie es ab — es muss sich dann erneut anmelden.',
  'profile.sessions.loading': 'Ihre Sitzungen werden geladen…',
  'profile.sessions.empty': 'Kein anderes Gerät ist angemeldet.',
  'profile.sessions.currentBadge': 'Dieses Gerät',
  'profile.sessions.unknownDevice': 'Unbekanntes Gerät',
  'profile.sessions.signedInAt': 'Angemeldet:',
  'profile.sessions.lastSeenAt': 'Zuletzt aktiv:',
  'profile.sessions.ip': 'IP:',
  'profile.sessions.revoke': 'Abmelden',
  'profile.sessions.revokeAll':
    '{count, plural, one {# anderes Gerät abmelden} other {# andere Geräte abmelden}}',
  'profile.sessions.revokeConfirmTitle': 'Dieses Gerät abmelden?',
  'profile.sessions.revokeConfirmBody':
    '{device} wird sofort abgemeldet und muss sich erneut anmelden. Ihre Daten sind nicht betroffen.',
  'profile.sessions.revokeAllConfirmTitle': 'Alle anderen Geräte abmelden?',
  'profile.sessions.revokeAllConfirmBody':
    '{count, plural, one {# anderes Gerät wird sofort abgemeldet.} other {# andere Geräte werden sofort abgemeldet.}} Dieses Gerät bleibt angemeldet, und Ihre Daten sind nicht betroffen.',
  'profile.sessions.loadError': 'Ihre Sitzungen konnten nicht geladen werden.',
  'profile.sessions.revokeError':
    'Diese Sitzung konnte nicht abgemeldet werden. Bitte erneut versuchen.',
  'profile.danger.title': 'Gefahrenzone',
  'profile.danger.body':
    'Diese Aktion löscht dein Konto und alle zugehörigen Daten endgültig (Bewerbungen, Unternehmen, Dokumente, E-Mail-Vorlagen, Fortschritt). Sie kann nicht rückgängig gemacht werden.',
  'profile.danger.confirmLabel': 'Tippe „{word}“ zur Bestätigung',
  'profile.danger.submit': 'Mein Konto löschen',
  'profile.danger.submitting': 'Wird gelöscht…',
  'profile.danger.wrongPassword': 'Das aktuelle Passwort ist falsch.',
  'profile.danger.error': 'Das Konto konnte nicht gelöscht werden. Versuch es erneut.',
  'profile.danger.confirmWord': 'LÖSCHEN',

  // ---- Enum labels -----------------------------------------------------

  'workMode.ON_SITE': 'Vor Ort',
  'workMode.HYBRID': 'Hybrid',
  'workMode.REMOTE': 'Remote',

  'employmentType.FULL_TIME': 'Vollzeit',
  'employmentType.PART_TIME': 'Teilzeit',
  'employmentType.CONTRACT': 'Befristet',
  'employmentType.INTERNSHIP': 'Praktikum',
  'employmentType.APPRENTICESHIP': 'Ausbildung',
  'employmentType.FREELANCE': 'Freiberuflich',
  'employmentType.TEMPORARY': 'Zeitarbeit',

  'source.JOB_BOARD': 'Jobbörse',
  'source.LINKEDIN': 'LinkedIn',
  'source.COMPANY_WEBSITE': 'Unternehmenswebsite',
  'source.REFERRAL': 'Empfehlung',
  'source.RECRUITER': 'Recruiter',
  'source.CAREER_FAIR': 'Jobmesse',
  'source.SPONTANEOUS': 'Initiativbewerbung',
  'source.OTHER': 'Sonstiges',

  'salaryPeriod.HOUR': '/ Stunde',
  'salaryPeriod.DAY': '/ Tag',
  'salaryPeriod.MONTH': '/ Monat',
  'salaryPeriod.YEAR': '/ Jahr',

  'emailCategory.FOLLOW_UP': 'Nachfassen',
  'emailCategory.THANK_YOU': 'Dank',
  'emailCategory.COLD_OUTREACH': 'Initiativbewerbung',
  'emailCategory.OFFER_NEGOTIATION': 'Angebotsverhandlung',
  'emailCategory.WITHDRAWAL': 'Rückzug der Bewerbung',
  'emailCategory.OTHER': 'Sonstiges',

  'companySize.1-10': '1 bis 10',
  'companySize.11-50': '11 bis 50',
  'companySize.51-200': '51 bis 200',
  'companySize.201-500': '201 bis 500',
  'companySize.501-1000': '501 bis 1000',
  'companySize.1000+': 'Mehr als 1000',


};
