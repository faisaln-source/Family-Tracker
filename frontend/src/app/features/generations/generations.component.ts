import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Person } from '../../core/api.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-generations',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-header">
      <div>
        <h1>By Generation</h1>
        <p>Browse all family members grouped by generation</p>
      </div>
    </div>

    <!-- Generation tabs -->
    <div class="gen-tabs">
      @for (g of availableGens; track g) {
        <button class="gen-tab" [class.active]="selectedGen === g" (click)="selectGen(g)">
          Generation {{ g }}
        </button>
      }
    </div>

    @if (loading) { <div class="loading-spinner"><div class="spinner"></div></div> }

    @if (!loading && genData) {
      <!-- Stats for this gen -->
      <div class="stats-grid" style="margin-bottom:24px;">
        <div class="stat-card">
          <div class="stat-icon purple"><span class="material-icons">people</span></div>
          <div><div class="stat-value">{{ genData.stats.total }}</div><div class="stat-label">Total</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue"><span class="material-icons">man</span></div>
          <div><div class="stat-value">{{ genData.stats.male }}</div><div class="stat-label">Male</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red"><span class="material-icons">woman</span></div>
          <div><div class="stat-value">{{ genData.stats.female }}</div><div class="stat-label">Female</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><span class="material-icons">favorite</span></div>
          <div><div class="stat-value">{{ genData.stats.alive }}</div><div class="stat-label">Living</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red"><span class="material-icons">history</span></div>
          <div><div class="stat-value">{{ genData.stats.deceased }}</div><div class="stat-label">Deceased</div></div>
        </div>
      </div>

      <div class="person-grid">
        @for (p of genData.data; track p.id) {
          <div class="person-card" [routerLink]="['/persons', p.id]">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
              @if (p.photo_url) {
                <img [src]="api.getImageUrl(p.photo_url)" class="person-avatar" [alt]="p.first_name"
                     (error)="$any($event.target).style.display='none'">
              } @else {
                <div class="person-avatar-placeholder" [style.background]="p.family_color || '#7c6cfa'">
                  {{ p.first_name[0] }}{{ p.last_name?.[0] || '' }}
                </div>
              }
              <div>
                <div class="person-name">{{ p.first_name }} {{ p.last_name }}</div>
                <div class="person-meta">{{ p.family_name }}</div>
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <span class="badge" [class]="p.gender === 'male' ? 'badge-male' : 'badge-female'">
                {{ p.gender === 'male' ? '♂' : '♀' }}
              </span>
              <span class="badge" [class]="p.is_alive ? 'badge-alive' : 'badge-dec'">
                {{ p.is_alive ? 'Living' : 'Deceased' }}
              </span>
            </div>
            @if (p.birthplace) { <div class="person-meta" style="margin-top:8px;">📍 {{ p.birthplace }}</div> }
            @if (p.dob) { <div class="person-meta">🎂 {{ p.dob }}</div> }
          </div>
        }
      </div>

      @if (genData.data.length === 0) {
        <div class="empty-state">
          <span class="material-icons">people</span>
          <h3>No members in Generation {{ selectedGen }}</h3>
        </div>
      }
    }
  `
})
export class GenerationsComponent implements OnInit {
  availableGens: number[] = [];
  selectedGen = 1;
  genData: any = null;
  loading = false;

  constructor(public api: ApiService) {}

  ngOnInit() {
    this.api.getStats().subscribe(res => {
      const max = res.data.maxGeneration || 6;
      this.availableGens = Array.from({ length: max }, (_, i) => i + 1);
      if (this.availableGens.length > 0) this.selectGen(1);
    });
  }

  selectGen(gen: number) {
    this.selectedGen = gen;
    this.loading = true;
    this.api.getByGeneration(gen).subscribe({
      next: (res) => { this.genData = res; this.loading = false; },
      error: () => this.loading = false
    });
  }
}
