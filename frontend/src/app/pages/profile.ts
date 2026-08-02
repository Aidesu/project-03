import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import {
  I18nService,
  LOCALE_NAMES,
  SUPPORTED_LOCALES,
  TranslationKey,
  isLocale,
} from '../core/i18n';
import { initialsOf } from '../core/initials';
import {
  ChangePasswordInput,
  DeleteAccountInput,
  ProfileService,
  UpdateAccountInput,
} from '../core/profile.service';

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
// Mirrors the backend RegisterDto / ChangePasswordDto minimum.
const PASSWORD_MIN = 12;

function passwordsMatchValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const newPassword = group.get('newPassword')?.value;
    const confirmNewPassword = group.get('confirmNewPassword')?.value;
    if (!newPassword || !confirmNewPassword) return null;
    return newPassword === confirmNewPassword ? null : { mismatch: true };
  };
}

/**
 * The confirmation word depends on the active language, so the check reads it
 * lazily instead of closing over a fixed string — switching language while the
 * danger-zone form is open must not leave the validator expecting the old word.
 */
function exactTextValidator(expected: () => string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null =>
    control.value === expected() ? null : { exactText: true };
}

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule],
  templateUrl: './profile.html',
})
export class Profile {
  private readonly fb = inject(FormBuilder);
  private readonly profileApi = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  readonly t = this.i18n.t;
  readonly user = this.auth.user;
  readonly passwordMin = PASSWORD_MIN;

  /** The word the user must type to delete, in the language they are reading. */
  readonly deleteConfirmationText = computed(() => this.t('profile.danger.confirmWord'));

  readonly initials = computed(() => initialsOf(this.user()?.name || this.user()?.email));

  readonly locales = SUPPORTED_LOCALES.map((value) => ({
    value,
    label: LOCALE_NAMES[value],
  }));

  readonly timezones: string[] =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : ['Europe/Paris', 'America/New_York', 'Asia/Tokyo'];

  // ---- Avatar --------------------------------------------------------
  readonly avatarUploading = signal(false);
  readonly avatarError = signal<TranslationKey | null>(null);

  // ---- Account info ---------------------------------------------------
  readonly accountForm = this.fb.nonNullable.group({
    name: this.fb.nonNullable.control('', [Validators.maxLength(100)]),
    email: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.email,
      Validators.maxLength(254),
    ]),
    currentPassword: this.fb.nonNullable.control('', [Validators.maxLength(128)]),
  });
  readonly accountSaving = signal(false);
  readonly accountError = signal<TranslationKey | null>(null);
  readonly accountSuccess = signal(false);

  // ---- Password ---------------------------------------------------
  readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: this.fb.nonNullable.control('', [
        Validators.required,
        Validators.maxLength(128),
      ]),
      newPassword: this.fb.nonNullable.control('', [
        Validators.required,
        Validators.minLength(12),
        Validators.maxLength(128),
      ]),
      confirmNewPassword: this.fb.nonNullable.control('', [Validators.required]),
    },
    { validators: [passwordsMatchValidator()] },
  );
  readonly passwordSaving = signal(false);
  readonly passwordError = signal<TranslationKey | null>(null);
  readonly passwordSuccess = signal(false);

  // ---- Settings ---------------------------------------------------
  readonly settingsForm = this.fb.nonNullable.group({
    locale: this.fb.nonNullable.control('fr'),
    timezone: this.fb.nonNullable.control('Europe/Paris'),
    weeklyApplicationGoal: this.fb.nonNullable.control(5, [
      Validators.required,
      Validators.min(1),
      Validators.max(50),
    ]),
    emailRemindersEnabled: this.fb.nonNullable.control(true),
  });
  readonly settingsLoading = signal(true);
  readonly settingsSaving = signal(false);
  readonly settingsError = signal<TranslationKey | null>(null);
  readonly settingsSuccess = signal(false);

  // ---- Danger zone ---------------------------------------------------
  readonly deleteForm = this.fb.nonNullable.group({
    currentPassword: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(128),
    ]),
    confirmation: this.fb.nonNullable.control('', [
      Validators.required,
      exactTextValidator(() => this.deleteConfirmationText()),
    ]),
  });
  readonly deleting = signal(false);
  readonly deleteError = signal<TranslationKey | null>(null);

  // Privacy — data export
  readonly exporting = signal(false);
  readonly exportError = signal<TranslationKey | null>(null);

  constructor() {
    const u = this.user();
    this.accountForm.patchValue({ name: u?.name ?? '', email: u?.email ?? '' });
    this.loadSettings();

    // The expected confirmation word is language-dependent, so an already
    // typed value has to be re-checked when the language changes — otherwise
    // the field would still read "valid" against the previous language's word.
    effect(() => {
      this.deleteConfirmationText();
      this.deleteForm.controls.confirmation.updateValueAndValidity();
    });
  }

  // ---- Avatar --------------------------------------------------------

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.avatarError.set(null);
    if (!AVATAR_ALLOWED_TYPES.has(file.type)) {
      this.avatarError.set('profile.avatar.badType');
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      this.avatarError.set('profile.avatar.tooLarge');
      return;
    }

    this.avatarUploading.set(true);
    this.profileApi.uploadAvatar(file).subscribe({
      next: ({ user }) => {
        this.auth.updateUser(user);
        this.avatarUploading.set(false);
      },
      error: () => {
        this.avatarUploading.set(false);
        this.avatarError.set('profile.avatar.uploadFailed');
      },
    });
  }

  removeAvatar(): void {
    if (this.avatarUploading()) return;
    this.avatarUploading.set(true);
    this.avatarError.set(null);
    this.profileApi.removeAvatar().subscribe({
      next: ({ user }) => {
        this.auth.updateUser(user);
        this.avatarUploading.set(false);
      },
      error: () => {
        this.avatarUploading.set(false);
        this.avatarError.set('profile.avatar.removeFailed');
      },
    });
  }

  // ---- Data export -----------------------------------------------------

  exportData(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.exportError.set(null);
    this.profileApi.exportData().subscribe({
      next: (blob) => {
        this.exporting.set(false);
        this.saveBlob(blob);
      },
      error: (err: HttpErrorResponse) => {
        this.exporting.set(false);
        // 429: the endpoint reads every table the account touches, so it is
        // capped at a few calls per hour — worth its own message rather than a
        // generic failure the user would retry straight into the same wall.
        this.exportError.set(
          err.status === 429
            ? 'profile.privacy.tooMany'
            : 'profile.privacy.error',
        );
      },
    });
  }

  private saveBlob(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `project-03-export-${new Date().toISOString().slice(0, 10)}.json`;
    // Attached before clicking: a detached anchor is ignored by some browsers.
    document.body.append(link);
    link.click();
    link.remove();
    // The blob stays pinned in memory until the URL is released, but revoking
    // it in the same task can cancel the download that just started — hand the
    // browser a tick first.
    setTimeout(() => URL.revokeObjectURL(url));
  }

  // ---- Account info ---------------------------------------------------

  submitAccount(): void {
    if (this.accountForm.invalid || this.accountSaving()) {
      this.accountForm.markAllAsTouched();
      return;
    }

    const v = this.accountForm.getRawValue();
    const currentUser = this.user();
    const nextEmail = v.email.trim().toLowerCase();
    const emailChanged = !!currentUser && nextEmail !== currentUser.email;

    if (emailChanged && !v.currentPassword) {
      this.accountError.set('profile.account.passwordRequiredForEmail');
      return;
    }

    const input: UpdateAccountInput = { name: v.name.trim(), email: nextEmail };
    if (emailChanged) input.currentPassword = v.currentPassword;

    this.accountSaving.set(true);
    this.accountError.set(null);
    this.accountSuccess.set(false);
    this.profileApi.updateAccount(input).subscribe({
      next: ({ user }) => {
        this.auth.updateUser(user);
        this.accountForm.patchValue({ currentPassword: '' });
        this.accountSaving.set(false);
        this.accountSuccess.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.accountSaving.set(false);
        this.accountError.set(this.mapAccountError(err));
      },
    });
  }

  private mapAccountError(err: HttpErrorResponse): TranslationKey {
    if (err.status === 403) return 'profile.account.wrongPassword';
    if (err.status === 409) return 'profile.account.emailTaken';
    return 'profile.account.saveError';
  }

  // ---- Password ---------------------------------------------------

  submitPassword(): void {
    if (this.passwordForm.invalid || this.passwordSaving()) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const v = this.passwordForm.getRawValue();
    const input: ChangePasswordInput = {
      currentPassword: v.currentPassword,
      newPassword: v.newPassword,
    };

    this.passwordSaving.set(true);
    this.passwordError.set(null);
    this.passwordSuccess.set(false);
    this.profileApi.changePassword(input).subscribe({
      next: () => {
        this.passwordSaving.set(false);
        this.passwordSuccess.set(true);
        this.passwordForm.reset({
          currentPassword: '',
          newPassword: '',
          confirmNewPassword: '',
        });
      },
      error: (err: HttpErrorResponse) => {
        this.passwordSaving.set(false);
        if (err.status === 403) {
          this.passwordError.set('profile.account.wrongPassword');
        } else if (err.status === 400) {
          this.passwordError.set('profile.password.sameAsCurrent');
        } else {
          this.passwordError.set('profile.password.error');
        }
      },
    });
  }

  // ---- Settings ---------------------------------------------------

  private loadSettings(): void {
    this.settingsLoading.set(true);
    this.settingsError.set(null);
    this.profileApi.getSettings().subscribe({
      next: (s) => {
        this.settingsForm.patchValue({
          locale: s.locale,
          timezone: s.timezone,
          weeklyApplicationGoal: s.weeklyApplicationGoal,
          emailRemindersEnabled: s.emailRemindersEnabled,
        });
        this.settingsLoading.set(false);
      },
      error: () => {
        this.settingsLoading.set(false);
        this.settingsError.set('profile.settings.loadError');
      },
    });
  }

  submitSettings(): void {
    if (this.settingsForm.invalid || this.settingsSaving()) {
      this.settingsForm.markAllAsTouched();
      return;
    }
    // Defence in depth: the select only offers supported locales, but the DOM
    // is not a trust boundary and the server allowlist must not be the only check.
    if (!isLocale(this.settingsForm.controls.locale.value)) {
      this.settingsError.set('profile.settings.saveError');
      return;
    }

    this.settingsSaving.set(true);
    this.settingsError.set(null);
    this.settingsSuccess.set(false);
    this.profileApi.updateSettings(this.settingsForm.getRawValue()).subscribe({
      next: (settings) => {
        // Apply what the server actually stored, not what was typed — the UI
        // must reflect the persisted state, including a rejected value.
        this.i18n.applySettings(settings);
        this.settingsSaving.set(false);
        this.settingsSuccess.set(true);
      },
      error: () => {
        this.settingsSaving.set(false);
        this.settingsError.set('profile.settings.saveError');
      },
    });
  }

  // ---- Danger zone ---------------------------------------------------

  submitDelete(): void {
    if (this.deleteForm.invalid || this.deleting()) {
      this.deleteForm.markAllAsTouched();
      return;
    }

    const input: DeleteAccountInput = this.deleteForm.getRawValue();

    this.deleting.set(true);
    this.deleteError.set(null);
    this.profileApi.deleteAccount(input).subscribe({
      next: () => {
        this.auth.clearSession();
        void this.router.navigateByUrl('/login');
      },
      error: (err: HttpErrorResponse) => {
        this.deleting.set(false);
        this.deleteError.set(
          err.status === 403 ? 'profile.danger.wrongPassword' : 'profile.danger.error',
        );
      },
    });
  }
}
