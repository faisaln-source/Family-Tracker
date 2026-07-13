import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '',          redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
  { path: 'tree',      loadComponent: () => import('./features/tree-view/tree-view.component').then(m => m.TreeViewComponent) },
  { path: 'persons',   loadComponent: () => import('./features/persons/persons.component').then(m => m.PersonsComponent) },
  { path: 'persons/:id', loadComponent: () => import('./features/person-detail/person-detail.component').then(m => m.PersonDetailComponent) },
  { path: 'generations', loadComponent: () => import('./features/generations/generations.component').then(m => m.GenerationsComponent) },
  { path: 'families',  loadComponent: () => import('./features/families/families.component').then(m => m.FamiliesComponent) },
  { path: '**',        redirectTo: 'dashboard' }
];
