import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProfileService } from './profile.service';

describe('ProfileService.exportData', () => {
  let service: ProfileService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProfileService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ProfileService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // Dropping `responseType: 'blob'` would not fail loudly — Angular would parse
  // the export as JSON and the download would quietly become a broken file.
  it('requests the export as a blob', () => {
    service.exportData().subscribe();

    const req = http.expectOne('/api/users/me/export');
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['{}'], { type: 'application/json' }));
  });

  it('passes the body through untouched', async () => {
    const payload = '{"meta":{"version":1}}';
    const received = new Promise<Blob>((resolve) =>
      service.exportData().subscribe(resolve),
    );

    http
      .expectOne('/api/users/me/export')
      .flush(new Blob([payload], { type: 'application/json' }));

    expect(await (await received).text()).toBe(payload);
  });
});

describe('ProfileService sessions', () => {
  let service: ProfileService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProfileService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ProfileService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // Under /api/auth, not /api/users/me: the refresh cookie is path-scoped to
  // the former, and without it the server cannot flag the caller's own device.
  it('reads sessions from the auth path', () => {
    service.listSessions().subscribe();

    const req = http.expectOne('/api/auth/sessions');
    expect(req.request.method).toBe('GET');
    req.flush({ sessions: [] });
  });

  it('revokes a single session by its family id', () => {
    service.revokeSession('fam-1').subscribe();

    const req = http.expectOne('/api/auth/sessions/fam-1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('revokes the other sessions without targeting an id', () => {
    service.revokeOtherSessions().subscribe();

    const req = http.expectOne('/api/auth/sessions');
    expect(req.request.method).toBe('DELETE');
    req.flush({ revoked: 2 });
  });
});
