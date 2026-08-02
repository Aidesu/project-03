import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompaniesService } from '../../core/companies.service';
import { CompanyListItem } from '../../core/models';
import { CompanyPicker } from './company-picker';

function company(id: string, name: string, location: string | null = null) {
  return {
    id,
    name,
    website: null,
    industry: null,
    location,
    size: null,
    logoUrl: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    _count: { applications: 0, contacts: 0 },
  } satisfies CompanyListItem;
}

const COMPANIES = [
  company('c1', 'Acme Inc.', 'Berlin'),
  company('c2', 'Acme Labs'),
  company('c3', 'Globex'),
];

function setup(items: CompanyListItem[] = COMPANIES) {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: CompaniesService,
        useValue: {
          list: () => of({ items, total: items.length, page: 1, pageSize: 100 }),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(CompanyPicker);
  const component = fixture.componentInstance;
  component.ngOnInit();
  return component;
}

/** Drives the component the way the DOM would. */
function type(component: CompanyPicker, value: string): void {
  component.onInput({ target: { value } } as unknown as Event);
}

function press(component: CompanyPicker, key: string): KeyboardEvent {
  const event = {
    key,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as KeyboardEvent;
  component.onKeydown(event);
  return event;
}

describe('CompanyPicker', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('filters the address book on what was typed', () => {
    const component = setup();
    type(component, 'acme');
    expect(component.suggestions().map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(component.open()).toBe(true);
  });

  it('reports the typed text through the form control', () => {
    const component = setup();
    const changes: string[] = [];
    component.registerOnChange((value) => changes.push(value));
    type(component, 'Acm');
    expect(changes).toEqual(['Acm']);
  });

  it('selects with the keyboard and emits the company', () => {
    const component = setup();
    const selected: CompanyListItem[] = [];
    component.companySelected.subscribe((c) => selected.push(c));
    component.registerOnChange(() => {});

    type(component, 'acme');
    press(component, 'ArrowDown');
    press(component, 'ArrowDown');
    press(component, 'Enter');

    expect(selected.map((c) => c.id)).toEqual(['c2']);
    expect(component.value()).toBe('Acme Labs');
    expect(component.open()).toBe(false);
  });

  it('wraps from the top of the list to the bottom', () => {
    const component = setup();
    type(component, 'acme');
    press(component, 'ArrowUp');
    expect(component.activeIndex()).toBe(1);
  });

  // Enter must still submit the surrounding form when nothing is highlighted.
  it('leaves Enter alone when no suggestion is active', () => {
    const component = setup();
    type(component, 'acme');
    const event = press(component, 'Enter');
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  // Otherwise Escape would also close the modal the picker sits in.
  it('keeps Escape from travelling further up', () => {
    const component = setup();
    type(component, 'acme');
    const event = press(component, 'Escape');
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(component.open()).toBe(false);
  });

  it('degrades to a plain text field when the list cannot be loaded', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: CompaniesService,
          useValue: { list: () => throwError(() => new Error('offline')) },
        },
      ],
    });
    const component = TestBed.createComponent(CompanyPicker).componentInstance;
    component.ngOnInit();

    const changes: string[] = [];
    component.registerOnChange((value) => changes.push(value));
    type(component, 'Acme');

    expect(component.suggestions()).toEqual([]);
    expect(changes).toEqual(['Acme']);
  });
});
