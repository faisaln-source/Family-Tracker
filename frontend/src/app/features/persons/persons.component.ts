import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { ApiService, Person, Family } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { PersonFormModalComponent } from '../person-form-modal/person-form-modal.component';

@Component({
  selector: 'app-persons',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PersonFormModalComponent],
  template: `
    <div class="page-header">
      <div>
        <h1>All Members</h1>
        <p>{{ total }} members across {{ families.length }} families</p>
      </div>
      <button class="btn btn-primary" (click)="openAddModal()">
        <span class="material-icons">person_add</span> Add Member
      </button>
    </div>

    <!-- Filters -->
    <div class="card" style="margin-bottom:22px;padding:16px 22px;">
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;">
        <input class="form-control" style="max-width:220px;" placeholder="Search by name…"
               [(ngModel)]="filters.q" (input)="onFilterChange()">
        <select class="form-control" style="width:170px;" [(ngModel)]="filters.family_id" (change)="onFilterChange()">
          <option value="">All Families</option>
          @for (f of families; track f.id) { <option [value]="f.id">{{ f.family_name }}</option> }
        </select>
        <select class="form-control" style="width:150px;" [(ngModel)]="filters.generation" (change)="onFilterChange()">
          <option value="">All Generations</option>
          @for (g of genList; track g) { <option [value]="g">Generation {{ g }}</option> }
        </select>
        <select class="form-control" style="width:130px;" [(ngModel)]="filters.gender" (change)="onFilterChange()">
          <option value="">Any Gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
        <select class="form-control" style="width:130px;" [(ngModel)]="filters.is_alive" (change)="onFilterChange()">
          <option value="">All</option>
          <option value="1">Living</option>
          <option value="0">Deceased</option>
        </select>
        <button class="btn btn-secondary btn-sm" (click)="clearFilters()">Clear</button>
      </div>
    </div>

    @if (loading) { <div class="loading-spinner"><div class="spinner"></div></div> }

    @if (!loading && persons.length === 0) {
      <div class="empty-state">
        <span class="material-icons">people</span>
        <h3>No members found</h3>
        <p>Try changing filters or add new members</p>
        <button class="btn btn-primary" (click)="openAddModal()">Add Member</button>
      </div>
    }

    <div class="person-grid">
      @for (p of persons; track p.id) {
        <div class="person-card" (click)="navigateTo(p.id)"
             [style.position]="'relative'" [style.overflow]="'hidden'">

          <!-- Inline delete confirmation overlay -->
          @if (confirmingDeleteId === p.id) {
            <div (click)="$event.stopPropagation()"
                 style="position:absolute;inset:0;background:rgba(20,14,40,0.97);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;border-radius:inherit;z-index:10;padding:20px;text-align:center;">
              <span class="material-icons" style="font-size:32px;color:#f87171;">warning</span>
              <div style="font-weight:600;color:#f0f2f8;">Delete {{ p.first_name }}?</div>
              <div style="font-size:0.78rem;color:var(--text-muted);">This will remove all their relationships too.</div>
              <div style="display:flex;gap:10px;">
                <button class="btn btn-secondary btn-sm" (click)="confirmingDeleteId=null">Cancel</button>
                <button class="btn btn-danger btn-sm" (click)="executeDelete(p)" [disabled]="deleting">
                  {{ deleting ? 'Deleting…' : 'Yes, Delete' }}
                </button>
              </div>
            </div>
          }

          <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px;">
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
            <span class="badge badge-gen">Gen {{ p.generation }}</span>
            <span class="badge" [class]="p.gender === 'male' ? 'badge-male' : 'badge-female'">
              {{ p.gender === 'male' ? '♂' : '♀' }}
            </span>
            <span class="badge" [class]="p.is_alive ? 'badge-alive' : 'badge-dec'">
              {{ p.is_alive ? 'Living' : 'Deceased' }}
            </span>
          </div>
          @if (p.birthplace) {
            <div class="person-meta" style="margin-top:8px;">📍 {{ p.birthplace }}</div>
          }
          @if (p.dob) {
            <div class="person-meta">🎂 {{ p.dob }}</div>
          }
          <div style="display:flex;gap:6px;margin-top:12px;" (click)="$event.stopPropagation()">
            <button class="btn btn-icon btn-sm" (click)="openEditModal(p)" title="Edit">
              <span class="material-icons" style="font-size:16px;">edit</span>
            </button>
            <button class="btn btn-danger btn-sm" (click)="confirmingDeleteId=p.id" title="Delete">
              <span class="material-icons" style="font-size:16px;">delete</span>
            </button>
          </div>
        </div>
      }
    </div>

    <!-- Add/Edit Modal -->
    @if (showModal) {
      <app-person-form-modal
        [person]="personToEdit"
        [families]="families"
        [lockedFamilyId]="lockedFamilyId"
        (close)="showModal = false"
        (saved)="onModalSaved()">
      </app-person-form-modal>
    }
  `
})
export class PersonsComponent implements OnInit {
  persons: Person[] = [];
  families: Family[] = [];
  total = 0;
  loading = true;
  showModal = false;
  personToEdit: Person | null = null;
  lockedFamilyId: number | null = null;
  confirmingDeleteId: number | null = null;
  deleting = false;
  genList: number[] = [];

  filters: any = { q: '', family_id: '', generation: '', gender: '', is_alive: '' };

  constructor(
    public api: ApiService,
    private toast: ToastService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.api.getFamilies().subscribe(res => this.families = res.data);
    this.route.queryParams.subscribe(p => {
      this.filters.q = p['q'] || '';
      this.filters.family_id = p['family_id'] || '';
      const editId = p['edit'] ? +p['edit'] : null;
      this.loadPersons(editId);
    });
  }

  loadPersons(editId?: number | null) {
    this.loading = true;
    const f: any = {};
    Object.keys(this.filters).forEach(k => { if (this.filters[k] !== '') f[k] = this.filters[k]; });
    this.api.getPersons(f).subscribe({
      next: (res) => {
        this.persons = res.data;
        this.total = res.total;
        this.loading = false;

        // Dynamically update available generations based on current filtered data
        // Only update if generation filter is not active, otherwise we'd lose other options
        if (!this.filters.generation) {
          const gens = new Set(this.persons.map(p => p.generation).filter(g => g != null));
          this.genList = Array.from(gens).sort((a, b) => a - b);
        }

        if (editId) {
          const p = this.persons.find(x => x.id === editId);
          if (p) {
            this.openEditModal(p);
            // Remove edit param from URL so refresh doesn't reopen modal
            this.router.navigate([], { queryParams: { edit: null }, queryParamsHandling: 'merge', replaceUrl: true });
          }
        }
      },
      error: () => this.loading = false
    });
  }

  onFilterChange() { clearTimeout((this as any)._ft); (this as any)._ft = setTimeout(() => this.loadPersons(), 350); }
  clearFilters() { this.filters = { q: '', family_id: '', generation: '', gender: '', is_alive: '' }; this.loadPersons(); }

  openAddModal() {
    this.personToEdit = null;
    // Lock family if a family filter is currently active
    this.lockedFamilyId = this.filters.family_id ? +this.filters.family_id : null;
    this.showModal = true;
  }

  openEditModal(p: Person) {
    this.personToEdit = p;
    this.lockedFamilyId = null; // No lock on edit — allow family reassignment
    this.showModal = true;
  }

  onModalSaved() {
    this.showModal = false;
    this.toast.show(this.personToEdit ? 'Member updated!' : 'Member added!');
    this.loadPersons();
  }

  executeDelete(p: Person) {
    this.deleting = true;
    this.api.deletePerson(p.id).subscribe({
      next: () => {
        this.toast.show('Member deleted');
        this.confirmingDeleteId = null;
        this.deleting = false;
        this.loadPersons();
      },
      error: (err) => {
        this.toast.show(err?.error?.error || 'Delete failed', 'error');
        this.deleting = false;
      }
    });
  }

  navigateTo(id: number) { this.router.navigate(['/persons', id]); }
}
