import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService, Family } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { RouterLink } from '@angular/router';

const COLORS = ['#7c6cfa','#f5c518','#10b981','#ef4444','#3b82f6','#a855f7','#f59e0b','#06b6d4','#ec4899'];

@Component({
  selector: 'app-families',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="page-header">
      <div>
        <h1>Families</h1>
        <p>{{ families.length }} family branches in your records</p>
      </div>
      <button class="btn btn-primary" (click)="openAddModal()">
        <span class="material-icons">add_home</span> Add Family
      </button>
    </div>

    @if (loading) { <div class="loading-spinner"><div class="spinner"></div></div> }

    <div class="family-grid">
      @for (f of families; track f.id) {
        <div class="card" style="position:relative;overflow:hidden;">
          <!-- Color accent -->
          <div style="position:absolute;top:0;left:0;right:0;height:4px;" [style.background]="f.color"></div>

          <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;margin-top:8px;">
            <div style="width:52px;height:52px;border-radius:12px;display:flex;align-items:center;justify-content:center;
                        font-size:1.5rem;font-weight:700;color:white;"
                 [style.background]="f.color">
              {{ f.family_name[0] }}
            </div>
            <div>
              <h3 style="font-family:'Inter',sans-serif;">{{ f.family_name }} Family</h3>
              @if (f.origin) { <div class="person-meta">📍 {{ f.origin }}</div> }
            </div>
          </div>

          @if (f.description) {
            <p style="font-size:0.85rem;margin-bottom:14px;line-height:1.5;">{{ f.description }}</p>
          }

          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding-top:14px;border-top:1px solid var(--border);">
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="material-icons" style="color:var(--text-muted);font-size:18px;line-height:1;">people</span>
              <span style="font-size:0.88rem;font-weight:600;white-space:nowrap;">{{ f.member_count }} members</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
              <a class="btn btn-secondary btn-sm" [routerLink]="['/persons']" [queryParams]="{family_id: f.id}"
                 style="white-space:nowrap;">
                View Members
              </a>
              <button class="btn btn-icon" style="padding:6px;" (click)="openEditModal(f)" title="Edit">
                <span class="material-icons" style="font-size:16px;">edit</span>
              </button>
              <button class="btn btn-danger" style="padding:6px;" (click)="confirmDelete(f)" title="Delete">
                <span class="material-icons" style="font-size:16px;">delete</span>
              </button>
            </div>
          </div>
        </div>
      }
    </div>

    @if (!loading && families.length === 0) {
      <div class="empty-state">
        <span class="material-icons">home</span>
        <h3>No families yet</h3>
        <p>Add your first family branch to get started</p>
        <button class="btn btn-primary" (click)="openAddModal()">Add Family</button>
      </div>
    }

    <!-- Modal -->
    @if (showModal) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingId ? 'Edit Family' : 'Add New Family' }}</h2>
            <button class="btn btn-icon" (click)="closeModal()"><span class="material-icons">close</span></button>
          </div>
          <div class="modal-body">
            <form [formGroup]="form">
              <div class="form-group">
                <label class="form-label">Family Name *</label>
                <input class="form-control" formControlName="family_name" placeholder="e.g. Sharma, Patel…">
              </div>
              <div class="form-group">
                <label class="form-label">Place of Origin</label>
                <input class="form-control" formControlName="origin" placeholder="Village, District, State">
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-control" formControlName="description" placeholder="History, notes about this family…"></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Color</label>
                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;">
                  @for (c of colorOptions; track c) {
                    <div (click)="form.patchValue({color:c})"
                         style="width:28px;height:28px;border-radius:50%;cursor:pointer;transition:all 0.15s;"
                         [style.background]="c"
                         [style.outline]="form.value.color===c ? '3px solid white' : 'none'"
                         [style.box-shadow]="form.value.color===c ? '0 0 0 5px '+c+'44' : 'none'">
                    </div>
                  }
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">Cancel</button>
            <button class="btn btn-primary" (click)="saveFamily()" [disabled]="saving || form.invalid">
              {{ saving ? 'Saving…' : (editingId ? 'Update' : 'Add Family') }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class FamiliesComponent implements OnInit {
  families: Family[] = [];
  loading = true;
  showModal = false;
  saving = false;
  editingId: number | null = null;
  colorOptions = COLORS;
  form: FormGroup;

  constructor(private api: ApiService, private toast: ToastService, private fb: FormBuilder) {
    this.form = this.fb.group({
      family_name: ['', Validators.required],
      origin: [''],
      description: [''],
      color: [COLORS[0]]
    });
  }

  ngOnInit() { this.loadFamilies(); }

  loadFamilies() {
    this.loading = true;
    this.api.getFamilies().subscribe({
      next: res => { this.families = res.data; this.loading = false; },
      error: () => this.loading = false
    });
  }

  openAddModal() {
    this.editingId = null;
    this.form.reset({ color: COLORS[this.families.length % COLORS.length] });
    this.showModal = true;
  }

  openEditModal(f: Family) {
    this.editingId = f.id;
    this.form.patchValue(f);
    this.showModal = true;
  }

  closeModal() { this.showModal = false; }

  saveFamily() {
    if (this.form.invalid) return;
    this.saving = true;
    const obs = this.editingId
      ? this.api.updateFamily(this.editingId, this.form.value)
      : this.api.createFamily(this.form.value);

    obs.subscribe({
      next: () => { this.toast.show(this.editingId ? 'Family updated!' : 'Family added!'); this.closeModal(); this.loadFamilies(); this.saving = false; },
      error: err => { this.toast.show(err?.error?.error || 'Save failed', 'error'); this.saving = false; }
    });
  }

  confirmDelete(f: Family) {
    if (!confirm(`Delete the ${f.family_name} family? Members will be unassigned.`)) return;
    this.api.deleteFamily(f.id).subscribe({
      next: () => { this.toast.show('Family deleted'); this.loadFamilies(); },
      error: err => this.toast.show(err?.error?.error || 'Delete failed', 'error')
    });
  }
}
