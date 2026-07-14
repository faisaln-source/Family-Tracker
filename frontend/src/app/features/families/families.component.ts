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
        <div class="card" style="position:relative;overflow:hidden;padding:0;">
          <!-- Color accent top bar -->
          <div style="position:absolute;top:0;left:0;right:0;height:4px;z-index:1;" [style.background]="f.color"></div>

          <!-- Cover image -->
          @if (f.image_url) {
            <div style="width:100%;height:140px;overflow:hidden;background:#111;">
              <img [src]="f.image_url" alt="{{ f.family_name }}"
                   style="width:100%;height:100%;object-fit:cover;opacity:0.85;display:block;">
            </div>
          } @else {
            <div style="width:100%;height:100px;display:flex;align-items:center;justify-content:center;"
                 [style.background]="f.color + '22'">
              <span class="material-icons" style="font-size:48px;" [style.color]="f.color">home</span>
            </div>
          }

          <!-- Card body -->
          <div style="padding:16px 18px 18px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
              <div style="width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;
                          font-size:1.3rem;font-weight:700;color:white;flex-shrink:0;"
                   [style.background]="f.color">
                {{ f.family_name[0] }}
              </div>
              <div>
                <h3 style="font-family:'Inter',sans-serif;margin:0;">{{ f.family_name }} Family</h3>
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

              <!-- Image Upload -->
              <div class="form-group">
                <label class="form-label">Family Cover Image</label>
                <!-- Preview -->
                @if (imagePreview) {
                  <div style="position:relative;margin-bottom:10px;border-radius:10px;overflow:hidden;height:130px;">
                    <img [src]="imagePreview" style="width:100%;height:100%;object-fit:cover;display:block;">
                    <button type="button" (click)="removeImage()"
                            style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.6);border:none;
                                   border-radius:50%;width:28px;height:28px;cursor:pointer;display:flex;
                                   align-items:center;justify-content:center;color:white;">
                      <span class="material-icons" style="font-size:16px;">close</span>
                    </button>
                  </div>
                }
                <!-- Drop zone -->
                <div class="image-drop-zone"
                     [class.drag-over]="isDragging"
                     (dragover)="$event.preventDefault(); isDragging=true"
                     (dragleave)="isDragging=false"
                     (drop)="onDrop($event)"
                     (click)="fileInput.click()">
                  <span class="material-icons" style="font-size:32px;color:var(--text-muted);margin-bottom:6px;">add_photo_alternate</span>
                  <span style="font-size:0.85rem;color:var(--text-muted);">Click or drag & drop an image</span>
                  <span style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">JPG, PNG, WEBP · max 5 MB</span>
                </div>
                <input #fileInput type="file" accept="image/jpeg,image/png,image/webp"
                       style="display:none" (change)="onFileSelected($event)">
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
  `,
  styles: [`
    .image-drop-zone {
      border: 2px dashed var(--border);
      border-radius: 10px;
      padding: 20px;
      text-align: center;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: border-color 0.2s, background 0.2s;
    }
    .image-drop-zone:hover, .image-drop-zone.drag-over {
      border-color: var(--accent);
      background: var(--accent-subtle, rgba(124,108,250,0.07));
    }
  `]
})
export class FamiliesComponent implements OnInit {
  families: Family[] = [];
  loading = true;
  showModal = false;
  saving = false;
  editingId: number | null = null;
  colorOptions = COLORS;
  form: FormGroup;

  selectedFile: File | null = null;
  imagePreview: string | null = null;
  isDragging = false;

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
    this.selectedFile = null;
    this.imagePreview = null;
    this.form.reset({ color: COLORS[this.families.length % COLORS.length] });
    this.showModal = true;
  }

  openEditModal(f: Family) {
    this.editingId = f.id;
    this.selectedFile = null;
    this.imagePreview = f.image_url || null;
    this.form.patchValue(f);
    this.showModal = true;
  }

  closeModal() { this.showModal = false; }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.handleFile(input.files[0]);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
    const file = event.dataTransfer?.files[0];
    if (file) this.handleFile(file);
  }

  handleFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      this.toast.show('Image must be under 5 MB', 'error');
      return;
    }
    this.selectedFile = file;
    const reader = new FileReader();
    reader.onload = e => this.imagePreview = e.target?.result as string;
    reader.readAsDataURL(file);
  }

  removeImage() {
    this.selectedFile = null;
    this.imagePreview = null;
  }

  saveFamily() {
    if (this.form.invalid) return;
    this.saving = true;

    const fd = new FormData();
    const v = this.form.value;
    fd.append('family_name', v.family_name);
    if (v.origin)      fd.append('origin', v.origin);
    if (v.description) fd.append('description', v.description);
    if (v.color)       fd.append('color', v.color);
    if (this.selectedFile) fd.append('image', this.selectedFile);

    const obs = this.editingId
      ? this.api.updateFamily(this.editingId, fd)
      : this.api.createFamily(fd);

    obs.subscribe({
      next: () => {
        this.toast.show(this.editingId ? 'Family updated!' : 'Family added!');
        this.closeModal();
        this.loadFamilies();
        this.saving = false;
      },
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
