import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ToastService } from './core/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    <div class="app-shell">
      <!-- Sidebar -->
      <aside class="sidebar" [class.open]="sidebarOpen">
        <div class="sidebar-logo">
          <div class="logo-icon">🌳</div>
          <div>
            <div class="logo-text">Family Tracker</div>
            <div class="logo-sub">Heritage & Ancestry</div>
          </div>
        </div>
        <nav class="sidebar-nav">
          <div class="nav-section-label">Overview</div>
          <a class="nav-item" routerLink="/dashboard" routerLinkActive="active" (click)="closeSidebar()">
            <span class="material-icons">dashboard</span> Dashboard
          </a>

          <div class="nav-section-label">Family Data</div>
          <a class="nav-item" routerLink="/tree" routerLinkActive="active" (click)="closeSidebar()">
            <span class="material-icons">account_tree</span> Family Tree
          </a>
          <a class="nav-item" routerLink="/persons" routerLinkActive="active" (click)="closeSidebar()">
            <span class="material-icons">people</span> All Members
          </a>
          <a class="nav-item" routerLink="/generations" routerLinkActive="active" (click)="closeSidebar()">
            <span class="material-icons">layers</span> By Generation
          </a>
          <a class="nav-item" routerLink="/families" routerLinkActive="active" (click)="closeSidebar()">
            <span class="material-icons">home</span> Families
          </a>
        </nav>
      </aside>

      <!-- Overlay for mobile sidebar -->
      @if (sidebarOpen) {
        <div class="sidebar-overlay" (click)="closeSidebar()"></div>
      }

      <!-- Header -->
      <header class="top-header">
        <button class="btn-icon mobile-menu-btn" (click)="sidebarOpen = !sidebarOpen">
          <span class="material-icons">menu</span>
        </button>
        <div class="header-title">Family Heritage Tracker</div>
        <div class="search-box">
          <span class="material-icons">search</span>
          <input type="text" placeholder="Search members..." (keyup.enter)="onSearch($event)" #searchInput>
        </div>
      </header>

      <!-- Main -->
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>

    <!-- Toast notifications -->
    <div class="toast-container">
      @for (toast of toasts$ | async; track toast.id) {
        <div class="toast" [class]="toast.type">
          <span class="material-icons" [class]="toast.type">
            {{ toast.type === 'success' ? 'check_circle' : 'error' }}
          </span>
          {{ toast.message }}
        </div>
      }
    </div>
  `
})
export class AppComponent {
  sidebarOpen = false;
  toasts$ = this.toastService.toasts$;
  constructor(private toastService: ToastService, private router: Router) {}

  closeSidebar() { this.sidebarOpen = false; }

  onSearch(event: any) {
    const q = event.target.value.trim();
    if (q) {
      this.router.navigate(['/persons'], { queryParams: { q } });
    }
  }
}
