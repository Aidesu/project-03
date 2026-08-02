import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationsService, CreateApplicationInput } from '../core/applications.service';
import {
  ApplicationDefaults,
  ApplicationDefaultsService,
} from '../core/application-defaults.service';
import { I18nService } from '../core/i18n';
import { CompanyListItem } from '../core/models';
import { ApplicationForm } from './application-form';

/** Route stub for the "new application" case — no `:id` in the URL. */
const NEW_ROUTE = { snapshot: { paramMap: convertToParamMap({}) } };

function company(overrides: Partial<CompanyListItem> = {}): CompanyListItem {
  return {
    id: 'company-1',
    name: 'Acme Inc.',
    website: null,
    industry: null,
    location: 'Berlin',
    size: null,
    logoUrl: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    _count: { applications: 0, contacts: 0 },
    ...overrides,
  };
}

function setup() {
  const create = vi.fn((_: CreateApplicationInput) => of({ id: 'new-id' }));
  const navigate = vi.fn();
  const remember = vi.fn();
  // Pinned so the seeded values do not depend on the machine's locale.
  const defaults: ApplicationDefaults = {
    source: '',
    workMode: '',
    employmentType: '',
    salaryPeriod: 'YEAR',
    salaryCurrency: 'EUR',
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: ActivatedRoute, useValue: NEW_ROUTE },
      { provide: Router, useValue: { navigate } },
      { provide: ApplicationsService, useValue: { create } },
      {
        provide: ApplicationDefaultsService,
        useValue: { read: () => defaults, remember },
      },
    ],
  });
  // The summaries render enum labels, so pin the language the assertions expect.
  TestBed.inject(I18nService).setLocale('en');
  const component = TestBed.createComponent(ApplicationForm).componentInstance;
  return { component, create, navigate, remember };
}

describe('ApplicationForm', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('starts with every optional section collapsed', () => {
    const { component } = setup();
    expect(component.isOpen('tracking')).toBe(false);
    expect(component.isOpen('salary')).toBe(false);
    expect(component.isOpen('extras')).toBe(false);
  });

  it('summarises a collapsed section from its current values', () => {
    const { component } = setup();
    component.form.patchValue({ source: 'LINKEDIN', workMode: 'REMOTE', excitement: 3 });
    expect(component.trackingSummary()).toBe('LinkedIn · Remote · ★★★');

    component.form.patchValue({ salaryMin: 40000, salaryMax: 55000 });
    expect(component.salarySummary()).toContain('EUR');
    expect(component.salarySummary()).toContain('/ year');
  });

  it('sends only the filled fields, and never a priority', () => {
    const { component, create, navigate } = setup();
    component.form.patchValue({ position: '  Frontend Developer  ', source: 'LINKEDIN' });
    component.submit();

    expect(create).toHaveBeenCalledTimes(1);
    const payload = create.mock.calls[0][0];
    // The three defaults the server would apply anyway; no empty optional field.
    expect(payload).toEqual({
      position: 'Frontend Developer',
      status: 'WISHLIST',
      salaryCurrency: 'EUR',
      salaryPeriod: 'YEAR',
      source: 'LINKEDIN',
    });
    expect(payload).not.toHaveProperty('priority');
    expect(navigate).toHaveBeenCalledWith(['/applications']);
  });

  it('remembers how the job was classified, and nothing about it', () => {
    const { component, remember } = setup();
    component.form.patchValue({
      position: 'Frontend Developer',
      companyName: 'Acme Inc.',
      source: 'LINKEDIN',
      workMode: 'REMOTE',
      salaryMin: 40000,
      notes: 'Referred by Dana',
    });
    component.submit();

    expect(remember).toHaveBeenCalledWith({
      source: 'LINKEDIN',
      workMode: 'REMOTE',
      employmentType: '',
      salaryPeriod: 'YEAR',
      salaryCurrency: 'EUR',
    });
  });

  // A collapsed section hides its fields: an error the user cannot see is an
  // error they cannot fix, so submitting must bring the offending group back.
  it('reveals the salary section when a hidden field is invalid', () => {
    const { component, create } = setup();
    component.form.patchValue({ position: 'Frontend Developer', salaryMin: -5 });
    component.submit();

    expect(create).not.toHaveBeenCalled();
    expect(component.isOpen('salary')).toBe(true);
    expect(component.isOpen('tracking')).toBe(false);
  });

  it('reveals the salary section when the range is inconsistent', () => {
    const { component, create } = setup();
    component.form.patchValue({
      position: 'Frontend Developer',
      salaryMin: 60000,
      salaryMax: 40000,
    });
    component.submit();

    expect(create).not.toHaveBeenCalled();
    expect(component.error()).toBe('applicationForm.salaryRangeError');
    expect(component.isOpen('salary')).toBe(true);
  });

  it('links the picked company and borrows its location', () => {
    const { component, create } = setup();
    component.form.patchValue({ position: 'Frontend Developer' });
    component.onCompanyPicked(company());

    expect(component.form.controls.companyName.value).toBe('Acme Inc.');
    expect(component.form.controls.companyId.value).toBe('company-1');
    expect(component.form.controls.location.value).toBe('Berlin');

    component.submit();
    expect(create.mock.calls[0][0]).toMatchObject({
      companyName: 'Acme Inc.',
      companyId: 'company-1',
      location: 'Berlin',
    });
  });

  it('never overwrites a location the user typed', () => {
    const { component } = setup();
    component.form.patchValue({ location: 'Remote' });
    component.onCompanyPicked(company());
    expect(component.form.controls.location.value).toBe('Remote');
  });

  // Posting an id that contradicts the name would link the wrong company.
  it('drops the link once the name no longer matches', () => {
    const { component, create } = setup();
    component.form.patchValue({ position: 'Frontend Developer' });
    component.onCompanyPicked(company());
    expect(component.form.controls.companyId.value).toBe('company-1');

    component.form.controls.companyName.setValue('Acme');
    expect(component.form.controls.companyId.value).toBe('');

    component.submit();
    expect(create.mock.calls[0][0]).not.toHaveProperty('companyId');
  });

  it('keeps a section open once the user expanded it', () => {
    const { component } = setup();
    component.toggle('extras');
    expect(component.isOpen('extras')).toBe(true);
    component.form.patchValue({ notes: 'Referred by Dana' });
    expect(component.isOpen('extras')).toBe(true);
    component.toggle('extras');
    expect(component.isOpen('extras')).toBe(false);
  });
});
