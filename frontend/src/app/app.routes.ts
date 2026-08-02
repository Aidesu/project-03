import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';
import { Shell } from './layout/shell';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login').then((m) => m.Login),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/register').then((m) => m.Register),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/forgot-password').then((m) => m.ForgotPassword),
  },
  // No guard on these two: they are reached from an e-mail link, which may be
  // opened in a browser that is signed in, signed out, or on another device.
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./pages/reset-password').then((m) => m.ResetPassword),
  },
  {
    path: 'verify-email',
    loadComponent: () => import('./pages/verify-email').then((m) => m.VerifyEmail),
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'applications',
        loadComponent: () => import('./pages/applications').then((m) => m.Applications),
      },
      {
        path: 'network',
        loadComponent: () => import('./pages/network').then((m) => m.Network),
      },
      {
        path: 'network/companies/:id',
        loadComponent: () =>
          import('./pages/company-detail').then((m) => m.CompanyDetailPage),
      },
      {
        path: 'network/contacts/:id',
        loadComponent: () =>
          import('./pages/contact-detail').then((m) => m.ContactDetailPage),
      },
      // The public company directory was withdrawn — old links land on the
      // private network page instead of a dead route.
      { path: 'discover', redirectTo: 'network' },
      { path: 'discover/:id', redirectTo: 'network' },
      {
        path: 'progression',
        loadComponent: () => import('./pages/progression').then((m) => m.Progression),
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile').then((m) => m.Profile),
      },
      {
        path: 'email-templates',
        loadComponent: () =>
          import('./pages/email-templates').then((m) => m.EmailTemplates),
      },
      {
        path: 'applications/new',
        loadComponent: () => import('./pages/application-form').then((m) => m.ApplicationForm),
      },
      {
        path: 'applications/:id/edit',
        loadComponent: () => import('./pages/application-form').then((m) => m.ApplicationForm),
      },
      {
        path: 'applications/:id',
        loadComponent: () =>
          import('./pages/application-detail').then((m) => m.ApplicationDetailPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
