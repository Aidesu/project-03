import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialog } from './shared/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ConfirmDialog],
  // The dialog sits outside the outlet on purpose: it has to survive the
  // navigation a confirmed action triggers, and it is reachable from the
  // unauthenticated pages too.
  template: '<router-outlet /><app-confirm-dialog />',
})
export class App {}
