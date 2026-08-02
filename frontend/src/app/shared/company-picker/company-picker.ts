import {
  Component,
  OnInit,
  computed,
  forwardRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CompaniesService } from '../../core/companies.service';
import { CompanyListItem } from '../../core/models';

/** Server-side cap on `pageSize` — the picker loads a single page of companies. */
const COMPANY_PICKER_LIMIT = 100;

/** Suggestions shown at once; the rest stay reachable by typing more. */
const MAX_SUGGESTIONS = 8;

let nextPickerId = 0;

/**
 * Combobox over the user's own company address book, backing a free-text name.
 *
 * The text is the value: anything can be typed, and the server resolves an
 * unknown name to a new Company. Picking an existing entry additionally emits
 * it, which lets the host link the real row instead of relying on a name match
 * — that is what keeps "Acme" and "Acme Inc." from becoming two companies.
 */
@Component({
  selector: 'app-company-picker',
  templateUrl: './company-picker.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CompanyPicker),
      multi: true,
    },
  ],
})
export class CompanyPicker implements ControlValueAccessor, OnInit {
  private readonly companiesApi = inject(CompaniesService);

  readonly inputId = input('');
  readonly placeholder = input('');
  readonly companySelected = output<CompanyListItem>();

  readonly listId = `company-picker-${nextPickerId++}`;
  readonly value = signal('');
  readonly open = signal(false);
  readonly activeIndex = signal(-1);
  readonly disabled = signal(false);

  private readonly companies = signal<CompanyListItem[]>([]);

  readonly suggestions = computed(() => {
    const needle = this.value().trim().toLowerCase();
    const all = this.companies();
    const matches = needle
      ? all.filter((c) => c.name.toLowerCase().includes(needle))
      : all;
    return matches.slice(0, MAX_SUGGESTIONS);
  });

  readonly activeOptionId = computed(() => {
    const index = this.activeIndex();
    return this.open() && index >= 0 ? `${this.listId}-${index}` : null;
  });

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit(): void {
    this.companiesApi
      .list({ pageSize: COMPANY_PICKER_LIMIT, sortBy: 'name', sortOrder: 'asc' })
      .subscribe({
        next: (page) => this.companies.set(page.items),
        // Suggestions are an accelerator, not a gate: on failure the field
        // stays a plain text input and the name is still resolved server-side.
        error: () => this.companies.set([]),
      });
  }

  // ---- ControlValueAccessor --------------------------------------------

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  // ---- Interaction ------------------------------------------------------

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.value.set(value);
    this.onChange(value);
    this.open.set(true);
    this.activeIndex.set(-1);
  }

  onFocus(): void {
    if (this.suggestions().length) this.open.set(true);
  }

  onBlur(): void {
    this.onTouched();
    this.close();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.open()) {
        this.open.set(true);
        return;
      }
      const count = this.suggestions().length;
      if (!count) return;
      const current = this.activeIndex();
      this.activeIndex.set(
        event.key === 'ArrowDown'
          ? (current + 1) % count
          : current <= 0
            ? count - 1
            : current - 1,
      );
      return;
    }

    if (event.key === 'Enter') {
      const active = this.suggestions()[this.activeIndex()];
      // Only swallow Enter when it picks something; otherwise it must still
      // submit the surrounding form.
      if (this.open() && active) {
        event.preventDefault();
        this.select(active);
      }
      return;
    }

    if (event.key === 'Escape' && this.open()) {
      // Closing the list must not also close a surrounding modal.
      event.stopPropagation();
      this.close();
    }
  }

  select(company: CompanyListItem): void {
    this.value.set(company.name);
    this.onChange(company.name);
    this.close();
    this.companySelected.emit(company);
  }

  private close(): void {
    this.open.set(false);
    this.activeIndex.set(-1);
  }
}
