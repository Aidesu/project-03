import { inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { ApplicationsService } from './applications.service';

/**
 * Pre-fills a new application's job title with the previous application's.
 *
 * Read from the API rather than from `localStorage` like the other form
 * defaults: a job title describes a specific search, and a browser profile can
 * outlive the session or be reused by another account — the server answer is
 * always scoped to whoever is logged in right now.
 *
 * Call from an injection context (a component constructor or a field
 * initializer). Never overwrites what the user already typed, and stays silent
 * on failure.
 */
export function seedPositionFromLatest(control: FormControl<string>): void {
  inject(ApplicationsService)
    .latestPosition()
    .pipe(takeUntilDestroyed())
    .subscribe((position) => {
      // The response can land after the user started typing.
      if (position && control.pristine && !control.value) {
        control.setValue(position);
      }
    });
}
