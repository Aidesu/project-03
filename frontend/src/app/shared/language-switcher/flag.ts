import { Component, input } from '@angular/core';
import { Locale } from '../../core/i18n';

/**
 * Flag pictogram for a locale, drawn inline as SVG.
 *
 * Not emoji: Windows renders regional-indicator pairs (🇫🇷) as bare letters
 * rather than flags, so an emoji would silently degrade for a large share of
 * users. Inline SVG renders identically everywhere and stays crisp.
 *
 * A flag is a country, not a language — it is decorative here (`aria-hidden`),
 * and the language name in its own script is what actually labels the option.
 */
@Component({
  selector: 'app-flag',
  template: `
    <svg
      viewBox="0 0 20 14"
      class="h-3.5 w-5 shrink-0 rounded-[2px] ring-1 ring-inset ring-black/10"
      aria-hidden="true"
      focusable="false"
    >
      @switch (locale()) {
        @case ('fr') {
          <rect width="6.667" height="14" fill="#002654" />
          <rect x="6.667" width="6.666" height="14" fill="#fff" />
          <rect x="13.333" width="6.667" height="14" fill="#ED2939" />
        }
        @case ('de') {
          <rect width="20" height="4.667" />
          <rect y="4.667" width="20" height="4.666" fill="#D00" />
          <rect y="9.333" width="20" height="4.667" fill="#FFCE00" />
        }
        @case ('es') {
          <rect width="20" height="14" fill="#AA151B" />
          <rect y="3.5" width="20" height="7" fill="#F1BF00" />
        }
        @case ('en') {
          <!-- Counterchanged saltire: the red diagonals are the white ones
               clipped to alternating quadrants, per the Union Flag geometry. -->
          <clipPath [attr.id]="clipId">
            <path d="M10 7h10v7zv7H10zH0V7zV0h10z" />
          </clipPath>
          <rect width="20" height="14" fill="#012169" />
          <path d="M0 0l20 14M20 0L0 14" stroke="#fff" stroke-width="2.8" />
          <path
            d="M0 0l20 14M20 0L0 14"
            [attr.clip-path]="'url(#' + clipId + ')'"
            stroke="#C8102E"
            stroke-width="1.9"
          />
          <path d="M10 0v14M0 7h20" stroke="#fff" stroke-width="4.7" />
          <path d="M10 0v14M0 7h20" stroke="#C8102E" stroke-width="2.8" />
        }
      }
    </svg>
  `,
})
export class Flag {
  readonly locale = input.required<Locale>();

  /**
   * The clip path needs a document-unique id: the switcher is instantiated
   * more than once per page (sidebar + mobile header), and duplicate ids would
   * make every flag resolve to the first one's clip.
   */
  protected readonly clipId = `flag-clip-${nextFlagId++}`;
}

let nextFlagId = 0;
