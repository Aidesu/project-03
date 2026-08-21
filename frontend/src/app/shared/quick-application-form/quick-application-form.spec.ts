import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ApplicationsService,
  CreateApplicationInput,
} from '../../core/applications.service';
import { CompanyListItem } from '../../core/models';
import {
  QuickApplicationForm,
  QuickApplicationResult,
} from './quick-application-form';

const COMPANY = {
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
} satisfies CompanyListItem;

function setup(
  response = of({ id: 'app-1' }),
  latest: Observable<string | null> = of(null),
) {
  const create = vi.fn((_: CreateApplicationInput) => response);
  const latestPosition = vi.fn(() => latest);
  TestBed.configureTestingModule({
    providers: [
      { provide: ApplicationsService, useValue: { create, latestPosition } },
    ],
  });
  const component = TestBed.createComponent(QuickApplicationForm).componentInstance;
  const results: QuickApplicationResult[] = [];
  component.saved.subscribe((r) => results.push(r));
  return { component, create, results };
}

describe('QuickApplicationForm', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('refuses to save without a job title', () => {
    const { component, create } = setup();
    component.submit();
    expect(create).not.toHaveBeenCalled();
    expect(component.form.controls.position.touched).toBe(true);
  });

  it('posts the three fields and nothing else', () => {
    const { component, create, results } = setup();
    component.form.patchValue({ position: '  Frontend Developer  ' });
    component.submit();

    expect(create).toHaveBeenCalledWith({
      position: 'Frontend Developer',
      status: 'WISHLIST',
    });
    expect(results).toEqual([
      { application: { id: 'app-1' }, continueEditing: false },
    ]);
  });

  it('carries the linked company when one was picked', () => {
    const { component, create } = setup();
    component.form.patchValue({ position: 'Frontend Developer' });
    component.onCompanyPicked(COMPANY);
    component.submit();

    expect(create).toHaveBeenCalledWith({
      position: 'Frontend Developer',
      status: 'WISHLIST',
      companyName: 'Acme Inc.',
      companyId: 'company-1',
    });
  });

  it('drops the link once the name no longer matches', () => {
    const { component, create } = setup();
    component.form.patchValue({ position: 'Frontend Developer' });
    component.onCompanyPicked(COMPANY);
    component.form.controls.companyName.setValue('Acme');
    component.submit();

    expect(create).toHaveBeenCalledWith({
      position: 'Frontend Developer',
      status: 'WISHLIST',
      companyName: 'Acme',
    });
  });

  it('flags the request to continue in the full form', () => {
    const { component, results } = setup();
    component.form.patchValue({ position: 'Frontend Developer' });
    component.submit(true);
    expect(results[0].continueEditing).toBe(true);
  });

  it('pre-fills the job title from the previous application', () => {
    const { component } = setup(of({ id: 'app-1' }), of('Frontend Developer'));
    expect(component.form.controls.position.value).toBe('Frontend Developer');
  });

  it('leaves a title the user already typed alone', () => {
    const latest = new Subject<string | null>();
    const { component } = setup(of({ id: 'app-1' }), latest);
    component.form.controls.position.setValue('Backend Developer');
    component.form.controls.position.markAsDirty();
    latest.next('Frontend Developer');

    expect(component.form.controls.position.value).toBe('Backend Developer');
  });

  it('surfaces a failed save and stays open', () => {
    const { component, results } = setup(
      throwError(() => new HttpErrorResponse({ status: 400 })),
    );
    component.form.patchValue({ position: 'Frontend Developer' });
    component.submit();

    expect(results).toEqual([]);
    expect(component.error()).toBe('applicationForm.invalidFields');
    expect(component.saving()).toBe(false);
  });
});
