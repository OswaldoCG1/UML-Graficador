import { Routes } from '@angular/router';
import { DesignerComponent } from './designer/designer.component';
export const routes: Routes = [
  { path: '', redirectTo: '/uml', pathMatch: 'full' },
  { path: 'uml', component: DesignerComponent }
];
