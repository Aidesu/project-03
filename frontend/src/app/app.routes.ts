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
        path: 'progression',
        loadComponent: () => import('./pages/progression').then((m) => m.Progression),
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
