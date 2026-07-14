import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService, Person, Family } from '../../core/api.service';

@Component({
  selector: 'app-person-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  styles: [`
    .rel-section { border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:12px; }
    .rel-section-title { display:flex;align-items:center;gap:6px;font-size:0.82rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:10px; }
    .person-chips { display:flex;flex-wrap:wrap;gap:6px; }
    .person-chip { display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:20px;font-size:0.8rem;cursor:pointer;transition:all .15s;border:1px solid var(--border);background:var(--bg-secondary); }
    .person-chip:hover { border-color:var(--accent); }
    .person-chip.selected-parent  { background:#7c6cfa22;border-color:#7c6cfa;color:#a99eff; }
    .person-chip.selected-spouse  { background:#ec489922;border-color:#ec4899;color:#f9a8d4; }
    .person-chip.selected-sibling { background:#f59e0b22;border-color:#f59e0b;color:#fcd34d; }
    .person-chip.selected-child   { background:#10b98122;border-color:#10b981;color:#6ee7b7; }
    .rel-empty { font-size:0.8rem;color:var(--text-muted);font-style:italic; }
    .gen-badge { font-size:0.7rem;background:var(--bg-primary);border-radius:4px;padding:1px 5px;margin-left:4px;color:var(--text-muted); }
    .search-dd { position:absolute;left:0;right:0;top:calc(100% + 4px);background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;max-height:180px;overflow-y:auto;z-index:300;box-shadow:0 8px 24px rgba(0,0,0,.4); }
    .search-item { padding:8px 12px;cursor:pointer;font-size:0.85rem;display:flex;justify-content:space-between; }
    .search-item:hover { background:rgba(124,108,250,.1); }
    .form-group { position:relative; }
  `],
  template: `
<div class="modal-overlay" (click)="close.emit()">
  <div class="modal" style="max-width:620px;" (click)="$event.stopPropagation()">
    <div class="modal-header">
      <h2>{{ person ? 'Edit Member' : 'Add New Member' }}</h2>
      <button class="btn btn-icon" (click)="close.emit()"><span class="material-icons">close</span></button>
    </div>
    <div class="modal-body">
      <form [formGroup]="form">
        <!-- Name row -->
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
        <!-- Gender / Status -->
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
        <!-- Family -->
        <div class="form-group">
          <label class="form-label">Family</label>
          @if (lockedFamilyId) {
            <div class="form-control" style="background:var(--bg-primary);display:flex;align-items:center;gap:8px;">
              <span class="material-icons" style="font-size:16px;color:var(--accent);">lock</span>{{ lockedFamilyName }}
            </div>
          } @else {
            <select class="form-control" formControlName="family_id">
              <option value="">Select family…</option>
              @for (f of families; track f.id) { <option [value]="f.id">{{ f.family_name }}</option> }
            </select>
          }
        </div>

        <!-- Select Parent (prominent picker) -->
        <div class="form-group" style="margin-bottom:6px;">
          <label class="form-label" style="display:flex;align-items:center;gap:6px;">
            <span class="material-icons" style="font-size:16px;color:#7c6cfa;">person</span>
            Select Parent
            <span style="font-size:0.72rem;color:var(--text-muted);font-weight:400;">(sets generation automatically)</span>
          </label>
          <!-- Selected parent chips -->
          @if (selectedParents.length) {
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
              @for (p of selectedParents; track p.id) {
                <span class="person-chip selected-parent">
                  <span class="material-icons" style="font-size:13px;">person</span>
                  {{ p.first_name }} {{ p.last_name || '' }}
                  <span class="gen-badge">Gen {{ p.generation }}</span>
                  <button type="button" (click)="removeParent(p)"
                    style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:14px;line-height:1;padding:0 0 0 4px;">×</button>
                </span>
              }
            </div>
          }
          <div style="position:relative;">
            <input class="form-control" [(ngModel)]="parentSearch" [ngModelOptions]="{standalone:true}"
                   placeholder="Type a name to search members…"
                   (input)="onSearch('parent')" (focus)="activeDD='parent'" (blur)="closeDD()">
            @if (activeDD==='parent' && ddResults.length) {
              <div class="search-dd">
                @for (p of ddResults; track p.id) {
                  <div class="search-item" (mousedown)="selectParent(p)">
                    <span>{{ p.first_name }} {{ p.last_name || '' }}</span>
                    <span class="gen-badge">Gen {{ p.generation }} → child Gen {{ p.generation + 1 }}</span>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Generation: auto or manual -->
        <div class="form-group">
          <label class="form-label">Generation
            @if (genAutoSet) {
              <span style="font-size:0.72rem;color:var(--accent-light);margin-left:6px;">· auto from parent</span>
              <button type="button" (click)="clearAutoGen()"
                style="background:none;border:none;cursor:pointer;font-size:0.72rem;color:var(--text-muted);margin-left:6px;">✕ clear</button>
            }
          </label>
          @if (genAutoSet) {
            <div class="form-control" style="background:var(--bg-primary);color:var(--accent-light);cursor:default;">
              Gen {{ currentGen }}
            </div>
          } @else {
            <input class="form-control" type="number" min="1" formControlName="generation"
                   placeholder="e.g. 1" (change)="onGenChange()">
            @if (familyEmpty) {
              <span style="font-size:0.72rem;color:var(--accent-light);">First member — defaulted to Gen 1</span>
            }
          }
        </div>
        <!-- DOB / DOD -->
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
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Birthplace</label>
            <input class="form-control" formControlName="birthplace" placeholder="Village, City">
          </div>
          <div class="form-group">
            <label class="form-label">
              <span style="display:flex;align-items:center;gap:5px;">
                <span class="material-icons" style="font-size:15px;color:var(--accent);">phone</span>
                Phone Number
              </span>
            </label>
            <input class="form-control" formControlName="phone" placeholder="e.g. +91 9876543210" type="tel">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Occupation</label>
          <input class="form-control" formControlName="occupation" placeholder="e.g. Farmer">
        </div>
        <div class="form-group">
          <label class="form-label">Bio / Notes</label>
          <textarea class="form-control" formControlName="bio" placeholder="Additional info…"></textarea>
        </div>

        <!-- ── RELATIONSHIPS ────────────────────────────────────────── -->
        @if (currentGen >= 1) {

          <!-- PARENTS (gen-1) -->
          @if (currentGen > 1) {
            <div class="rel-section">
              <div class="rel-section-title">
                <span class="material-icons" style="font-size:16px;color:#7c6cfa;">people</span>
                Parents <span class="gen-badge">from Gen {{ currentGen - 1 }}</span>
              </div>
              @if (loadingRels) { <span class="rel-empty">Loading…</span> }
              @else if (parentPool.length === 0) { <span class="rel-empty">No Gen {{ currentGen - 1 }} members found</span> }
              @else {
                <div class="person-chips">
                  @for (p of parentPool; track p.id) {
                    <span class="person-chip" [class.selected-parent]="hasIn(selectedParents,p.id)"
                          (click)="togglePerson(selectedParents, p)">
                      <span class="material-icons" style="font-size:13px;">{{ hasIn(selectedParents,p.id)?'check':'add' }}</span>
                      {{ p.first_name }} {{ p.last_name || '' }}
                    </span>
                  }
                </div>
              }
              <!-- fallback search -->
              <div style="margin-top:8px;position:relative;">
                <input class="form-control" style="font-size:0.82rem;" [(ngModel)]="parentSearch"
                       [ngModelOptions]="{standalone:true}" placeholder="Search other members…"
                       (input)="onSearch('parent')" (focus)="activeDD='parent'" (blur)="closeDD()">
                @if (activeDD==='parent' && ddResults.length) {
                  <div class="search-dd">
                    @for (p of ddResults; track p.id) {
                      <div class="search-item" (mousedown)="togglePerson(selectedParents,p);parentSearch='';activeDD=null">
                        {{ p.first_name }} {{ p.last_name }} <span class="gen-badge">Gen {{ p.generation }}</span>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          }

          <!-- SPOUSE (same gen) -->
          <div class="rel-section">
            <div class="rel-section-title">
              <span class="material-icons" style="font-size:16px;color:#ec4899;">favorite</span>
              Spouse <span class="gen-badge">same Gen {{ currentGen }}</span>
            </div>
            @if (loadingRels) { <span class="rel-empty">Loading…</span> }
            @else if (sameGenPool.length === 0) { <span class="rel-empty">No Gen {{ currentGen }} members yet</span> }
            @else {
              <div class="person-chips">
                @for (p of sameGenPool; track p.id) {
                  <span class="person-chip" [class.selected-spouse]="hasIn(selectedSpouses,p.id)"
                        (click)="togglePerson(selectedSpouses, p)">
                    <span class="material-icons" style="font-size:13px;">{{ hasIn(selectedSpouses,p.id)?'check':'add' }}</span>
                    {{ p.first_name }} {{ p.last_name || '' }}
                  </span>
                }
              </div>
            }
            <div style="margin-top:8px;position:relative;">
              <input class="form-control" style="font-size:0.82rem;" [(ngModel)]="spouseSearch"
                     [ngModelOptions]="{standalone:true}" placeholder="Search other members…"
                     (input)="onSearch('spouse')" (focus)="activeDD='spouse'" (blur)="closeDD()">
              @if (activeDD==='spouse' && ddResults.length) {
                <div class="search-dd">
                  @for (p of ddResults; track p.id) {
                    <div class="search-item" (mousedown)="togglePerson(selectedSpouses,p);spouseSearch='';activeDD=null">
                      {{ p.first_name }} {{ p.last_name }} <span class="gen-badge">Gen {{ p.generation }}</span>
                    </div>
                  }
                </div>
              }
            </div>
          </div>

          <!-- SIBLINGS (same gen) -->
          <div class="rel-section">
            <div class="rel-section-title">
              <span class="material-icons" style="font-size:16px;color:#f59e0b;">group</span>
              Brother / Sister <span class="gen-badge">same Gen {{ currentGen }}</span>
            </div>
            @if (loadingRels) { <span class="rel-empty">Loading…</span> }
            @else if (sameGenPool.length === 0) { <span class="rel-empty">No Gen {{ currentGen }} members yet</span> }
            @else {
              <div class="person-chips">
                @for (p of sameGenPool; track p.id) {
                  @if (!hasIn(selectedSpouses, p.id)) {
                    <span class="person-chip" [class.selected-sibling]="hasIn(selectedSiblings,p.id)"
                          (click)="togglePerson(selectedSiblings, p)">
                      <span class="material-icons" style="font-size:13px;">{{ hasIn(selectedSiblings,p.id)?'check':'add' }}</span>
                      {{ p.first_name }} {{ p.last_name || '' }}
                    </span>
                  }
                }
              </div>
            }
          </div>

          <!-- CHILDREN (gen+1, edit mode only) -->
          @if (person) {
            <div class="rel-section">
              <div class="rel-section-title">
                <span class="material-icons" style="font-size:16px;color:#10b981;">child_care</span>
                Children <span class="gen-badge">from Gen {{ currentGen + 1 }}</span>
              </div>
              @if (loadingRels) { <span class="rel-empty">Loading…</span> }
              @else if (childPool.length === 0) { <span class="rel-empty">No Gen {{ currentGen + 1 }} members yet</span> }
              @else {
                <div class="person-chips">
                  @for (p of childPool; track p.id) {
                    <span class="person-chip" [class.selected-child]="hasIn(selectedChildren,p.id)"
                          (click)="toggleChild(p)">
                      <span class="material-icons" style="font-size:13px;">{{ hasIn(selectedChildren,p.id)?'check':'add' }}</span>
                      {{ p.first_name }} {{ p.last_name || '' }}
                    </span>
                  }
                </div>
              }
            </div>
          }
        }

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
  @Input() lockedFamilyId: number | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<any>();

  form: FormGroup;
  saving = false;
  selectedFile: File | null = null;
  familyEmpty = false;

  // Pools loaded by generation
  parentPool:   Person[] = [];   // gen-1
  sameGenPool:  Person[] = [];   // same gen
  childPool:    Person[] = [];   // gen+1 (edit only)
  loadingRels   = false;

  // Selected relations
  selectedParents:  Person[] = [];
  selectedSpouses:  Person[] = [];
  selectedSiblings: Person[] = [];
  selectedChildren: Person[] = [];

  // Track original children for diff (edit mode)
  originalChildren: Person[] = [];
  originalSpouses:  Person[] = [];

  // Search fallback
  parentSearch = ''; spouseSearch = '';
  activeDD: string | null = null;
  ddResults: Person[] = [];
  genAutoSet = false;

  private searchTimer: any;

  get currentGen(): number { return +this.form.get('generation')?.value || 0; }
  get lockedFamilyName(): string { return this.families.find(f => f.id === this.lockedFamilyId)?.family_name || ''; }

  constructor(private fb: FormBuilder, private api: ApiService) {
    this.form = this.fb.group({
      first_name: ['', Validators.required],
      last_name: [''],
      gender: ['male'],
      is_alive: ['1'],
      family_id: [''],
      generation: [null],
      dob: [''], dod: [''], birthplace: [''], occupation: [''], bio: [''], phone: [''],
      parent_ids: ['']
    });
  }

  ngOnInit() {
    this.initForm();
    this.form.get('is_alive')?.valueChanges.subscribe(val => {
      if (String(val) === '1') { this.form.get('dod')?.disable(); this.form.patchValue({ dod: '' }, { emitEvent: false }); }
      else this.form.get('dod')?.enable();
    });
  }

  ngOnChanges(c: SimpleChanges) {
    if (c['person'] && !c['person'].firstChange) this.initForm();
  }

  initForm() {
    this.selectedFile = null;
    this.selectedParents = []; this.selectedSpouses = [];
    this.selectedSiblings = []; this.selectedChildren = [];
    this.originalChildren = []; this.originalSpouses = [];
    this.parentPool = []; this.sameGenPool = []; this.childPool = [];
    this.familyEmpty = false;

    if (this.person) {
      // Edit mode — load full person data
      this.api.getPerson(this.person.id).subscribe(res => {
        const p = res.data;
        this.form.patchValue({ ...p, is_alive: String(p.is_alive) });
        if (this.lockedFamilyId) this.form.patchValue({ family_id: this.lockedFamilyId });
        this.selectedParents  = p.parents  ? [...p.parents]  : [];
        this.selectedSpouses  = p.spouses  ? [...p.spouses]  : [];
        this.selectedChildren = p.children ? [...p.children] : [];
        this.originalSpouses  = [...this.selectedSpouses];
        this.originalChildren = [...this.selectedChildren];
        if (String(p.is_alive) === '1') this.form.get('dod')?.disable();
        this.syncParentIds();
        this.loadGenPools(p.generation);
      });
    } else {
      // Add mode
      const familyId = this.lockedFamilyId || null;
      this.form.reset({ gender: 'male', is_alive: '1', family_id: familyId || '' });
      this.form.get('dod')?.disable();
      this.syncParentIds();

      if (familyId) {
        // Check member count — if 0, default gen 1
        this.api.getPersons({ family_id: familyId }).subscribe(res => {
          if (res.total === 0) {
            this.familyEmpty = true;
            this.form.patchValue({ generation: 1 });
          }
        });
      }
    }
  }

  onGenChange() {
    const gen = this.currentGen;
    if (gen >= 1) this.loadGenPools(gen);
  }

  // ── Parent picker methods ─────────────────────────────────────────────
  selectParent(p: Person) {
    if (!this.hasIn(this.selectedParents, p.id)) this.selectedParents.push(p);
    this.parentSearch = ''; this.activeDD = null; this.ddResults = [];
    // Auto-set generation from the HIGHEST parent gen
    const maxParentGen = Math.max(...this.selectedParents.map(x => x.generation));
    this.form.patchValue({ generation: maxParentGen + 1 });
    this.genAutoSet = true;
    this.syncParentIds();
    this.loadGenPools(maxParentGen + 1);
  }

  removeParent(p: Person) {
    this.selectedParents = this.selectedParents.filter(x => x.id !== p.id);
    this.syncParentIds();
    if (this.selectedParents.length === 0) {
      this.genAutoSet = false;
    } else {
      const maxParentGen = Math.max(...this.selectedParents.map(x => x.generation));
      this.form.patchValue({ generation: maxParentGen + 1 });
      this.loadGenPools(maxParentGen + 1);
    }
  }

  clearAutoGen() {
    this.genAutoSet = false;
    this.form.patchValue({ generation: null });
    this.sameGenPool = []; this.childPool = [];
  }

  loadGenPools(gen: number) {
    this.loadingRels = true;
    const fid = this.lockedFamilyId || this.form.get('family_id')?.value || null;
    const filters: any = {};
    if (fid) filters.family_id = fid;

    const excludeId = this.person?.id;

    const filter = (list: Person[]) => list.filter(p => p.id !== excludeId);

    let done = 0;
    const tick = () => { if (++done === (gen > 1 ? 3 : 2)) this.loadingRels = false; };

    // Gen-1 (parents)
    if (gen > 1) {
      this.api.getPersons({ ...filters, generation: gen - 1 }).subscribe(r => {
        this.parentPool = filter(r.data); tick();
      });
    }

    // Same gen (spouse / sibling)
    this.api.getPersons({ ...filters, generation: gen }).subscribe(r => {
      this.sameGenPool = filter(r.data); tick();
    });

    // Gen+1 (children, edit only)
    this.api.getPersons({ ...filters, generation: gen + 1 }).subscribe(r => {
      this.childPool = filter(r.data); tick();
    });
  }

  // Generic toggle
  hasIn(list: Person[], id: number) { return list.some(x => x.id === id); }
  togglePerson(list: Person[], p: Person) {
    const idx = list.findIndex(x => x.id === p.id);
    if (idx === -1) list.push(p); else list.splice(idx, 1);
    this.syncParentIds();
  }
  toggleChild(p: Person) { this.togglePerson(this.selectedChildren, p); }

  syncParentIds() {
    this.form.patchValue({ parent_ids: this.selectedParents.map(p => p.id).join(',') });
  }

  onFileChange(e: any) { this.selectedFile = e.target.files[0] || null; }

  onSearch(type: 'parent' | 'spouse') {
    const q = type === 'parent' ? this.parentSearch : this.spouseSearch;
    clearTimeout(this.searchTimer);
    if (!q || q.length < 2) { this.ddResults = []; return; }
    const fid = this.lockedFamilyId || this.form.get('family_id')?.value;
    const f: any = { q };
    if (fid) f.family_id = fid;
    this.searchTimer = setTimeout(() => {
      this.api.getPersons(f).subscribe(r => {
        this.ddResults = r.data.filter((p: Person) => p.id !== this.person?.id);
      });
    }, 300);
  }

  closeDD() { setTimeout(() => { this.activeDD = null; this.ddResults = []; }, 200); }

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
      next: (res: any) => {
        const pid = this.person?.id ?? res?.data?.id;
        if (pid) this.applyRelations(pid);
        else { this.saving = false; this.saved.emit(); }
      },
      error: (err: any) => { this.saving = false; alert(err?.error?.error || 'Save failed'); }
    });
  }

  private applyRelations(pid: number) {
    const calls: Promise<any>[] = [];

    // Spouses: diff original vs current
    this.selectedSpouses.forEach(s => {
      if (!this.hasIn(this.originalSpouses, s.id))
        calls.push(this.api.addMarriage(pid, s.id).toPromise().catch(() => {}));
    });
    this.originalSpouses.forEach(s => {
      if (!this.hasIn(this.selectedSpouses, s.id))
        calls.push(this.api.removeMarriage(pid, s.id).toPromise().catch(() => {}));
    });

    // Children: diff
    this.selectedChildren.forEach(c => {
      if (!this.hasIn(this.originalChildren, c.id))
        calls.push(this.api.addRelationship(pid, c.id).toPromise().catch(() => {}));
    });
    this.originalChildren.forEach(c => {
      if (!this.hasIn(this.selectedChildren, c.id))
        calls.push(this.api.removeRelationship(pid, c.id).toPromise().catch(() => {}));
    });

    // Siblings: inherit their parents + link sibling → same parents
    this.selectedSiblings.forEach(sib => {
      // Get sibling's parents and add current person as their child too
      calls.push(
        this.api.getPerson(sib.id).toPromise().then((res: any) => {
          const sibParents: Person[] = res?.data?.parents || [];
          return Promise.all(sibParents.map((sp: Person) =>
            this.api.addRelationship(sp.id, pid).toPromise().catch(() => {})
          ));
        }).catch(() => {})
      );
    });

    Promise.all(calls).finally(() => { this.saving = false; this.saved.emit(); });
  }
}
