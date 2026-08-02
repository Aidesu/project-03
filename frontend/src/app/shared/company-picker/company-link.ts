import { signal } from '@angular/core';
import { FormControl } from '@angular/forms';

/** The minimum a company must expose to be linkable. */
export interface LinkableCompany {
  id: string;
  name: string;
}

/**
 * Keeps a free-text company name and the id of the address-book row it stands
 * for consistent.
 *
 * The id survives only while the name still matches the company it was taken
 * from, so a payload can never carry an id that contradicts the name the user
 * sees. Shared by every form that pairs a `CompanyPicker` with a `companyId`
 * control: one invariant, one implementation.
 */
export class CompanyLink {
  private readonly picked = signal<LinkableCompany | null>(null);

  constructor(
    private readonly nameControl: FormControl<string>,
    private readonly idControl: FormControl<string>,
  ) {}

  /** Wire to the picker's `companySelected` output. */
  select(company: LinkableCompany): void {
    this.picked.set(company);
    // Name and id are written together: a partial write would make the next
    // `reconcile()` see a mismatch and drop the link that was just made.
    this.nameControl.setValue(company.name, { emitEvent: false });
    this.idControl.setValue(company.id, { emitEvent: false });
  }

  /** Wire to the form's `valueChanges`. */
  reconcile(): void {
    const picked = this.picked();
    if (!picked) return;
    if (this.nameControl.value.trim() === picked.name) return;
    this.picked.set(null);
    this.idControl.setValue('', { emitEvent: false });
  }

  /**
   * Re-adopts a link loaded from the server. The caller decides whether the
   * stored name still matches; patch the id control in the same pass.
   */
  restore(company: LinkableCompany | null): void {
    this.picked.set(company);
  }
}
