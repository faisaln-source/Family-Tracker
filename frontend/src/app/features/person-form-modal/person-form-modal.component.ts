import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService, Person, Family } from '../../core/api.service';

@Component({
  selector: 'app-person-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="modal-overlay" (click)="close.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>{{ person ? 'Edit Member' : 'Add New Member' }}</h2>
          <button class="btn btn-icon" (click)="close.emit()">
            <span class="material-icons">close</span>
          </button>
        </div>
        <div class="modal-body">
          <form [formGroup]="form">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">First Name *</label>
                <input class="form-control" formControlName="first_name" placeholder="First name">
              </div>
              <div class="form-group">
                <label class="form-label">Last Name</label>
                <input class="form-control" formControlName="last_name" placeholder="Last name">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Gender</label>
                <select class="form-control" formControlName="gender">
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Status</label>
                <select class="form-control" formControlName="is_alive">
                  <option value="1">Living</option>
                  <option value="0">Deceased</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Family</label>
                <select class="form-control" formControlName="family_id">
                  <option value="">Select family…</option>
                  @for (f of families; track f.id) { <option [value]="f.id">{{ f.family_name }}</option> }
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Generation
                  @if (genAutoSet) { <span style="font-size:0.72rem;color:var(--accent-light);margin-left:6px;">(auto)</span> }
                </label>
                @if (genAutoSet) {
                  <div class="form-control" style="background:var(--bg-primary);color:var(--accent-light);cursor:default;">
                    Gen {{ form.get('generation')?.value }} <span style="font-size:0.78rem;color:var(--text-muted);"> · from parent</span>
                  </div>
                } @else {
                  <input class="form-control" type="number" min="1" formControlName="generation" placeholder="e.g. 1">
                }
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Date of Birth</label>
                <input class="form-control" type="date" formControlName="dob">
              </div>
              <div class="form-group">
                <label class="form-label">Date of Death</label>
                <input class="form-control" type="date" formControlName="dod">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Birthplace</label>
              <input class="form-control" formControlName="birthplace" placeholder="Village, City, Country">
            </div>
            <div class="form-group">
              <label class="form-label">Occupation</label>
              <input class="form-control" formControlName="occupation" placeholder="e.g. Farmer, Teacher">
            </div>
            <div class="form-group">
              <label class="form-label">Bio / Notes</label>
              <textarea class="form-control" formControlName="bio" placeholder="Any additional information…"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Parent(s)
                @if (selectedParents.length) { <span style="font-size:0.72rem;color:var(--accent-light);margin-left:6px;">{{ selectedParents.length }} selected</span> }
              </label>
              @if (selectedParents.length) {
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
                  @for (p of selectedParents; track p.id) {
                    <span style="display:inline-flex;align-items:center;gap:4px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:20px;padding:2px 10px 2px 10px;font-size:0.78rem;color:var(--text-primary);">
                      {{ p.first_name }} {{ p.last_name || '' }}
                      <button type="button" (click)="removeParent(p.id)" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:14px;line-height:1;padding:0 0 0 2px;">×</button>
                    </span>
                  }
                </div>
              }
              <input class="form-control" type="text" [(ngModel)]="parentSearch" [ngModelOptions]="{standalone:true}" (input)="onSearchInput()" (focus)="showParentDropdown=true" placeholder="Search to add parent…">
              @if (showParentDropdown && parentSearchResults.length > 0) {
                <div style="position:relative;z-index:200;">
                  <div style="position:absolute;top:4px;left:0;right:0;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;max-height:200px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.4);">
                    @for (p of parentSearchResults; track p.id) {
                      <div (mousedown)="addParent(p)" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;cursor:pointer;font-size:0.85rem;" [style.background]="hasParent(p.id) ? 'var(--bg-accent)' : 'transparent'">
                        <span>{{ p.first_name }} {{ p.last_name || '' }} <span style="color:var(--text-muted);">(Gen {{ p.generation }})</span></span>
                        @if (hasParent(p.id)) { <span class="material-icons" style="font-size:16px;color:var(--accent);">check</span> }
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
            <div class="form-group">
              <label class="form-label">Photo</label>
              <input type="file" class="form-control" accept="image/*" (change)="onFileChange($event)">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="close.emit()">Cancel</button>
          <button class="btn btn-primary" (click)="save()" [disabled]="saving || form.invalid">
            {{ saving ? 'Saving…' : (person ? 'Update' : 'Add Member') }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class PersonFormModalComponent implements OnInit, OnChanges {
  @Input() person: Person | null = null;
  @Input() families: Family[] = [];
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<any>();

  form: FormGroup;
  saving = false;
  selectedFile: File | null = null;
  genAutoSet = false;
  
  selectedParents: Person[] = [];
  parentSearch = '';
  showParentDropdown = false;
  parentSearchResults: Person[] = [];
  private searchTimer: any;
  private genTimer: any;

  constructor(private fb: FormBuilder, private api: ApiService) {
    this.form = this.fb.group({
      first_name: ['', Validators.required],
      last_name: [''],
      gender: ['male'],
      is_alive: ['1'],
      family_id: [''],
      generation: [null],
      dob: [''], dod: [''], birthplace: [''], occupation: [''], bio: [''],
      parent_ids: ['']
    });
  }

  ngOnInit() {
    this.initForm();
    this.form.get('is_alive')?.valueChanges.subscribe(val => {
      if (String(val) === '1') {
        this.form.get('dod')?.disable();
        this.form.patchValue({ dod: '' }, { emitEvent: false });
      } else {
        this.form.get('dod')?.enable();
      }
    });
  }
  
  ngOnChanges(changes: SimpleChanges) {
    if (changes['person'] && !changes['person'].firstChange) this.initForm();
  }

  initForm() {
    this.selectedFile = null;
    this.genAutoSet = false;
    this.parentSearch = '';
    this.showParentDropdown = false;
    
    if (this.person) {
      this.api.getPerson(this.person.id).subscribe(res => {
        const fullPerson = res.data;
        this.form.patchValue({ ...fullPerson, is_alive: String(fullPerson.is_alive) });
        this.selectedParents = fullPerson.parents ? [...fullPerson.parents] : [];
        if (String(fullPerson.is_alive) === '1') this.form.get('dod')?.disable();
        else this.form.get('dod')?.enable();
        this.syncParentIds();
      });
    } else {
      this.form.reset({ gender: 'male', is_alive: '1' });
      this.form.get('dod')?.disable();
      this.selectedParents = [];
      this.syncParentIds();
    }
  }

  onFileChange(e: any) { this.selectedFile = e.target.files[0] || null; }

  onSearchInput() {
    clearTimeout(this.searchTimer);
    if (!this.parentSearch || this.parentSearch.length < 2) { this.parentSearchResults = []; return; }
    this.searchTimer = setTimeout(() => {
      this.api.getPersons({ q: this.parentSearch }).subscribe(res => {
        this.parentSearchResults = res.data.filter((p: Person) => p.id !== this.person?.id);
        this.showParentDropdown = true;
      });
    }, 300);
  }

  hasParent(id: number) { return this.selectedParents.some(p => p.id === id); }
  
  addParent(p: Person) {
    if (!this.hasParent(p.id)) this.selectedParents.push(p);
    else this.selectedParents = this.selectedParents.filter(x => x.id !== p.id);
    this.syncParentIds();
  }
  
  removeParent(id: number) {
    this.selectedParents = this.selectedParents.filter(x => x.id !== id);
    this.syncParentIds();
  }

  syncParentIds() {
    const ids = this.selectedParents.map(p => p.id);
    this.form.patchValue({ parent_ids: ids.join(',') });
    
    clearTimeout(this.genTimer);
    if (ids.length === 0) { this.genAutoSet = false; return; }
    
    this.genTimer = setTimeout(() => {
      this.api.getPerson(ids[0]).subscribe({
        next: (res) => {
          this.form.patchValue({ generation: res.data.generation + 1 });
          this.genAutoSet = true;
        },
        error: () => this.genAutoSet = false
      });
    }, 300);
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.getRawValue();
    if (String(v.is_alive) === '1') v.dod = '';
    const fd = new FormData();
    Object.keys(v).forEach(k => { if (v[k] != null) fd.append(k, v[k]); });
    if (this.selectedFile) fd.append('photo', this.selectedFile);

    const obs = this.person
      ? this.api.updatePerson(this.person.id, fd)
      : this.api.createPerson(fd);

    obs.subscribe({
      next: () => { this.saving = false; this.saved.emit(); },
      error: (err) => { this.saving = false; alert(err?.error?.error || 'Save failed'); }
    });
  }
}
