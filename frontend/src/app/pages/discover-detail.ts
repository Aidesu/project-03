import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { avatarColor } from '../core/avatar-color';
import { DiscoverService } from '../core/discover.service';
import { DiscoverCompany, MyReviewContext } from '../core/models';
import { starDisplay } from '../core/rating-display';

@Component({
  selector: 'app-discover-detail',
  imports: [FormsModule, RouterLink, DecimalPipe],
  templateUrl: './discover-detail.html',
})
export class DiscoverDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly discover = inject(DiscoverService);

  readonly company = signal<DiscoverCompany | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);

  readonly myReview = signal<MyReviewContext | null>(null);
  readonly submitting = signal(false);
  readonly submitError = signal(false);
  readonly justSubmitted = signal(false);

  selectedRating = 0;
  didRespond = true;

  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.discover.getOne(this.id).subscribe({
      next: (c) => {
        this.company.set(c);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
    this.loadMyReview();
  }

  private loadMyReview(): void {
    this.discover.getMyReview(this.id).subscribe({
      next: (ctx) => {
        this.myReview.set(ctx);
        this.selectedRating = ctx.existingReview?.rating ?? 0;
        this.didRespond = ctx.existingReview?.didRespond ?? ctx.suggestedDidRespond ?? true;
      },
      // Non-fatal: the review widget just stays hidden.
      error: () => {},
    });
  }

  setRating(n: number): void {
    this.selectedRating = n;
  }

  submitReview(): void {
    if (this.submitting() || this.selectedRating < 1) return;
    this.submitting.set(true);
    this.submitError.set(false);
    this.justSubmitted.set(false);
    this.discover
      .submitReview(this.id, { rating: this.selectedRating, didRespond: this.didRespond })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.justSubmitted.set(true);
          // Re-fetch rather than hand-rolling optimistic aggregate math client-side.
          this.load();
        },
        error: () => {
          this.submitting.set(false);
          this.submitError.set(true);
        },
      });
  }

  avatarColor(name: string): string {
    return avatarColor(name);
  }

  starDisplay(avg: number | null): string {
    return starDisplay(avg);
  }
}
