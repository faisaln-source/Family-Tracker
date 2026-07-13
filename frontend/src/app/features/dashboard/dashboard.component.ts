import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, Stats } from '../../core/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-header">
      <div>
        <h1>Dashboard</h1>
        <p>Overview of your family heritage across all generations</p>
      </div>
      <a class="btn btn-primary" routerLink="/persons">
        <span class="material-icons">person_add</span> Add Member
      </a>
    </div>

    @if (loading) {
      <div class="loading-spinner"><div class="spinner"></div><span>Loading...</span></div>
    }

    @if (!loading && stats) {
      <!-- Stats Row -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon purple"><span class="material-icons">people</span></div>
          <div>
            <div class="stat-value">{{ stats.totalPersons }}</div>
            <div class="stat-label">Total Members</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon gold"><span class="material-icons">home</span></div>
          <div>
            <div class="stat-value">{{ stats.totalFamilies }}</div>
            <div class="stat-label">Families</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue"><span class="material-icons">layers</span></div>
          <div>
            <div class="stat-value">{{ stats.maxGeneration }}</div>
            <div class="stat-label">Generations</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><span class="material-icons">favorite</span></div>
          <div>
            <div class="stat-value">{{ stats.alive }}</div>
            <div class="stat-label">Living</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red"><span class="material-icons">history</span></div>
          <div>
            <div class="stat-value">{{ stats.deceased }}</div>
            <div class="stat-label">Ancestors (Deceased)</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple"><span class="material-icons">favorite_border</span></div>
          <div>
            <div class="stat-value">{{ stats.totalMarriages }}</div>
            <div class="stat-label">Marriages</div>
          </div>
        </div>
      </div>

      <!-- Generation breakdown + Family breakdown -->
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px;">
        <!-- Generations -->
        <div class="card">
          <h3 style="margin-bottom:18px;">By Generation</h3>
          @for (gen of stats.byGeneration; track gen.generation) {
            <div style="margin-bottom:14px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                <span style="font-size:0.85rem;color:var(--text-secondary);">
                  Generation {{ gen.generation }}
                </span>
                <span style="font-size:0.85rem;font-weight:600;">{{ gen.count }}</span>
              </div>
              <div style="height:6px;background:var(--bg-secondary);border-radius:99px;overflow:hidden;">
                <div style="height:100%;border-radius:99px;background:linear-gradient(90deg,var(--accent),#a855f7);"
                     [style.width.%]="(gen.count / stats!.totalPersons) * 100"></div>
              </div>
              <div style="display:flex;gap:12px;margin-top:4px;font-size:0.72rem;color:var(--text-muted);">
                <span>👨 {{ gen.male }} Male</span>
                <span>👩 {{ gen.female }} Female</span>
              </div>
            </div>
          }
        </div>

        <!-- Families -->
        <div class="card">
          <h3 style="margin-bottom:18px;">By Family</h3>
          @for (fam of stats.byFamily; track fam.family_name) {
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
              <div style="width:12px;height:12px;border-radius:50%;flex-shrink:0;"
                   [style.background]="fam.color"></div>
              <div style="flex:1;">
                <div style="display:flex;justify-content:space-between;">
                  <span style="font-size:0.88rem;font-weight:500;">{{ fam.family_name }}</span>
                  <span style="font-size:0.85rem;color:var(--text-muted);">{{ fam.count }}</span>
                </div>
                <div style="height:4px;background:var(--bg-secondary);border-radius:99px;margin-top:5px;overflow:hidden;">
                  <div style="height:100%;border-radius:99px;"
                       [style.background]="fam.color"
                       [style.width.%]="(fam.count / stats!.totalPersons) * 100"></div>
                </div>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Quick links -->
      <div class="card">
        <h3 style="margin-bottom:18px;">Quick Actions</h3>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <a class="btn btn-secondary" routerLink="/tree">
            <span class="material-icons">account_tree</span> View Family Tree
          </a>
          <a class="btn btn-secondary" routerLink="/generations">
            <span class="material-icons">layers</span> Browse by Generation
          </a>
          <a class="btn btn-secondary" routerLink="/families">
            <span class="material-icons">home</span> Manage Families
          </a>
          <a class="btn btn-secondary" routerLink="/persons">
            <span class="material-icons">people</span> All Members
          </a>
        </div>
      </div>
    }

    @if (!loading && !stats) {
      <div class="empty-state">
        <span class="material-icons">family_restroom</span>
        <h3>No data yet</h3>
        <p>Start by adding families and members</p>
        <a class="btn btn-primary" routerLink="/families">Add First Family</a>
      </div>
    }
  `
})
export class DashboardComponent implements OnInit {
  stats: Stats | null = null;
  loading = true;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getStats().subscribe({
      next: (res) => { this.stats = res.data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }
}
