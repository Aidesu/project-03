import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
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
import { initialsOf } from '../core/initials';
import {
  ChangePasswordInput,
  DeleteAccountInput,
  ProfileService,
  UpdateAccountInput,
} from '../core/profile.service';

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DELETE_CONFIRMATION_TEXT = 'SUPPRIMER';

function passwordsMatchValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const newPassword = group.get('newPassword')?.value;
    const confirmNewPassword = group.get('confirmNewPassword')?.value;
    if (!newPassword || !confirmNewPassword) return null;
    return newPassword === confirmNewPassword ? null : { mismatch: true };
  };
}

function exactTextValidator(expected: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null =>
    control.value === expected ? null : { exactText: true };
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

  readonly user = this.auth.user;
  readonly deleteConfirmationText = DELETE_CONFIRMATION_TEXT;

  readonly initials = computed(() => initialsOf(this.user()?.name || this.user()?.email));

  readonly locales = [
    { value: 'fr', label: 'Français' },
    { value: 'en', label: 'English' },
  ];

  readonly timezones: string[] =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : ['Europe/Paris', 'America/New_York', 'Asia/Tokyo'];

  // ---- Avatar --------------------------------------------------------
  readonly avatarUploading = signal(false);
  readonly avatarError = signal<string | null>(null);

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
  readonly accountError = signal<string | null>(null);
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
  readonly passwordError = signal<string | null>(null);
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
  readonly settingsError = signal<string | null>(null);
  readonly settingsSuccess = signal(false);

  // ---- Danger zone ---------------------------------------------------
  readonly deleteForm = this.fb.nonNullable.group({
    currentPassword: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(128),
    ]),
    confirmation: this.fb.nonNullable.control('', [
      Validators.required,
      exactTextValidator(DELETE_CONFIRMATION_TEXT),
    ]),
  });
  readonly deleting = signal(false);
  readonly deleteError = signal<string | null>(null);

  constructor() {
    const u = this.user();
    this.accountForm.patchValue({ name: u?.name ?? '', email: u?.email ?? '' });
    this.loadSettings();
  }

  // ---- Avatar --------------------------------------------------------

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.avatarError.set(null);
    if (!AVATAR_ALLOWED_TYPES.has(file.type)) {
      this.avatarError.set('Formats acceptés : JPEG, PNG, WebP.');
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      this.avatarError.set('Image trop volumineuse (2 Mo maximum).');
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
        this.avatarError.set(
          "Échec de l'envoi — vérifie qu'il s'agit bien d'une image valide.",
        );
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
        this.avatarError.set('Impossible de retirer la photo.');
      },
    });
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
      this.accountError.set(
        "Le mot de passe actuel est requis pour changer d'adresse email.",
      );
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

  private mapAccountError(err: HttpErrorResponse): string {
    if (err.status === 403) return 'Mot de passe actuel incorrect.';
    if (err.status === 409) return 'Cette adresse email est déjà utilisée.';
    return "Impossible d'enregistrer les modifications. Réessaie.";
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
          this.passwordError.set('Mot de passe actuel incorrect.');
        } else if (err.status === 400) {
          this.passwordError.set(
            "Le nouveau mot de passe doit être différent de l'actuel.",
          );
        } else {
          this.passwordError.set('Impossible de changer le mot de passe. Réessaie.');
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
        this.settingsError.set('Impossible de charger les paramètres.');
      },
    });
  }

  submitSettings(): void {
    if (this.settingsForm.invalid || this.settingsSaving()) {
      this.settingsForm.markAllAsTouched();
      return;
    }

    this.settingsSaving.set(true);
    this.settingsError.set(null);
    this.settingsSuccess.set(false);
    this.profileApi.updateSettings(this.settingsForm.getRawValue()).subscribe({
      next: () => {
        this.settingsSaving.set(false);
        this.settingsSuccess.set(true);
      },
      error: () => {
        this.settingsSaving.set(false);
        this.settingsError.set("Impossible d'enregistrer les paramètres. Réessaie.");
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
          err.status === 403
            ? 'Mot de passe actuel incorrect.'
            : 'Impossible de supprimer le compte. Réessaie.',
        );
      },
    });
  }
}
