import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { ApiService, Person, Family } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { PersonFormModalComponent } from '../person-form-modal/person-form-modal.component';

@Component({
  selector: 'app-person-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PersonFormModalComponent],
  styles: [`
    .person-mini { display:flex; align-items:center; justify-content:space-between;
      padding:8px 10px; border-radius:6px; margin-bottom:4px; font-size:0.88rem;
      font-weight:500; transition:all 0.18s; }
    .person-mini:hover { background:var(--bg-hover); }
    .person-mini span { cursor:pointer; flex:1; }
    .person-mini span:hover { color:var(--accent-light); }
    .add-rel-btn { display:flex; align-items:center; gap:6px; padding:7px 12px;
      border-radius:6px; border:1px dashed var(--border); background:none;
      color:var(--text-muted); font-size:0.82rem; cursor:pointer; width:100%;
      margin-top:6px; transition:all 0.18s; }
    .add-rel-btn:hover { border-color:var(--accent); color:var(--accent-light); background:var(--accent-dim); }
    .tab-btn { padding:7px 16px; border-radius:99px; border:1px solid var(--border);
      background:var(--bg-card); color:var(--text-secondary); font-size:0.83rem;
      cursor:pointer; transition:all 0.18s; }
    .tab-btn.active { background:var(--accent); border-color:var(--accent); color:white; }
    .search-result { padding:8px 12px; border-radius:6px; cursor:pointer; font-size:0.88rem;
      display:flex; align-items:center; justify-content:space-between; }
    .search-result:hover { background:var(--bg-hover); }
  `],
  template: `
    <div style="max-width:920px;margin:0 auto;">
      <a class="btn btn-secondary btn-sm" routerLink="/persons" style="margin-bottom:20px;display:inline-flex;">
        <span class="material-icons" style="font-size:16px;">arrow_back</span> Back
      </a>

      @if (loading) { <div class="loading-spinner"><div class="spinner"></div></div> }

      @if (!loading && person) {
        <!-- Hero -->
        <div class="card" style="display:flex;gap:28px;align-items:flex-start;margin-bottom:22px;flex-wrap:wrap;">
          <div style="position:relative;">
            @if (person.photo_url) {
              <img [src]="'http://localhost:3000' + person.photo_url"
                   style="width:110px;height:110px;border-radius:50%;object-fit:cover;border:3px solid var(--border-accent);"
                   [alt]="person.first_name">
            } @else {
              <div style="width:110px;height:110px;border-radius:50%;display:flex;align-items:center;
                          justify-content:center;font-size:2.5rem;font-weight:700;color:white;
                          border:3px solid var(--border-accent);"
                   [style.background]="person.family_color || '#7c6cfa'">
                {{ person.first_name[0] }}{{ person.last_name?.[0] || '' }}
              </div>
            }
          </div>
          <div style="flex:1;min-width:200px;">
            <h1 style="font-size:1.8rem;margin-bottom:8px;">{{ person.first_name }} {{ person.last_name }}</h1>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
              <span class="badge badge-gen">Generation {{ person.generation }}</span>
              <span class="badge" [class]="person.gender==='male'?'badge-male':'badge-female'">
                {{ person.gender==='male' ? '♂ Male' : '♀ Female' }}
              </span>
              <span class="badge" [class]="person.is_alive?'badge-alive':'badge-dec'">
                {{ person.is_alive ? '● Living' : '⚫ Deceased' }}
              </span>
              @if (person.family_name) {
                <span class="badge" [style.background]="(person.family_color||'#7c6cfa')+'22'"
                      [style.color]="person.family_color||'#7c6cfa'">
                  {{ person.family_name }} Family
                </span>
              }
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
              @if (person.dob) { <div><div style="color:var(--text-muted);font-size:0.78rem;">Born</div><div>{{ person.dob }}</div></div> }
              @if (person.dod) { <div><div style="color:var(--text-muted);font-size:0.78rem;">Died</div><div>{{ person.dod }}</div></div> }
              @if (person.birthplace) { <div><div style="color:var(--text-muted);font-size:0.78rem;">Birthplace</div><div>{{ person.birthplace }}</div></div> }
              @if (person.occupation) { <div><div style="color:var(--text-muted);font-size:0.78rem;">Occupation</div><div>{{ person.occupation }}</div></div> }
            </div>
            @if (person.bio) {
              <div style="padding-top:12px;border-top:1px solid var(--border);"><p>{{ person.bio }}</p></div>
            }
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <button class="btn btn-secondary btn-sm" (click)="showEditModal = true">
              <span class="material-icons" style="font-size:16px;">edit</span> Edit
            </button>
            <a class="btn btn-secondary btn-sm" [routerLink]="['/tree']" [queryParams]="{family_id: person.family_id}">
              <span class="material-icons" style="font-size:16px;">account_tree</span> Tree
            </a>
          </div>
        </div>

        <!-- Relationships -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">

          <!-- Parents -->
          <div class="card">
            <h3 style="margin-bottom:14px;display:flex;align-items:center;gap:8px;">
              <span class="material-icons" style="color:var(--accent-light);">supervisor_account</span>
              Parents ({{ person.parents?.length || 0 }})
            </h3>
            @for (p of person.parents; track p.id) {
              <div class="person-mini">
                <span (click)="goTo(p.id)">{{ fullName(p) }}</span>
                <button class="btn btn-icon" style="padding:4px;" title="Remove parent"
                        (click)="removeRelationship(p.id, person!.id, 'parent')">
                  <span class="material-icons" style="font-size:14px;color:#ef4444;">close</span>
                </button>
              </div>
            }
            <button class="add-rel-btn" (click)="openRelModal('parent')">
              <span class="material-icons" style="font-size:16px;">add</span> Link Parent
            </button>
          </div>

          <!-- Spouses -->
          <div class="card">
            <h3 style="margin-bottom:14px;display:flex;align-items:center;gap:8px;">
              <span class="material-icons" style="color:#f472b6;">favorite</span>
              Spouse(s) ({{ person.spouses?.length || 0 }})
            </h3>
            @for (s of person.spouses; track s.id) {
              <div class="person-mini">
                <span (click)="goTo(s.id)">{{ fullName(s) }}</span>
                @if (s.married_on) { <span style="font-size:0.72rem;color:var(--text-muted);margin-right:6px;">{{ s.married_on }}</span> }
                <button class="btn btn-icon" style="padding:4px;" title="Remove spouse"
                        (click)="removeMarriage(s.id)">
                  <span class="material-icons" style="font-size:14px;color:#ef4444;">close</span>
                </button>
              </div>
            }
            <button class="add-rel-btn" (click)="openRelModal('spouse')">
              <span class="material-icons" style="font-size:16px;">add</span> Add Spouse
            </button>
          </div>

          <!-- Siblings -->
          <div class="card">
            <h3 style="margin-bottom:14px;display:flex;align-items:center;gap:8px;">
              <span class="material-icons" style="color:#60a5fa;">group</span>
              Siblings ({{ person.siblings?.length || 0 }})
            </h3>
            @for (s of person.siblings; track s.id) {
              <div class="person-mini">
                <span (click)="goTo(s.id)">{{ fullName(s) }}</span>
              </div>
            }
            @if (!person.siblings?.length) { <p style="font-size:0.84rem;">No siblings recorded</p> }
          </div>

          <!-- Children -->
          <div class="card">
            <h3 style="margin-bottom:14px;display:flex;align-items:center;gap:8px;">
              <span class="material-icons" style="color:#10b981;">child_care</span>
              Children ({{ person.children?.length || 0 }})
            </h3>
            @for (c of person.children; track c.id) {
              <div class="person-mini">
                <span (click)="goTo(c.id)">{{ fullName(c) }}</span>
                <span class="badge badge-gen" style="margin:0 6px;font-size:0.65rem;">Gen {{ c.generation }}</span>
                <button class="btn btn-icon" style="padding:4px;" title="Remove child"
                        (click)="removeRelationship(person!.id, c.id, 'child')">
                  <span class="material-icons" style="font-size:14px;color:#ef4444;">close</span>
                </button>
              </div>
            }
            <div style="display:flex;gap:8px;margin-top:6px;">
              <button class="add-rel-btn" style="flex:1;" (click)="openRelModal('new-child')">
                <span class="material-icons" style="font-size:16px;">person_add</span> Add New Child
              </button>
              <button class="add-rel-btn" style="flex:1;" (click)="openRelModal('child')">
                <span class="material-icons" style="font-size:16px;">link</span> Link Existing
              </button>
            </div>
          </div>
        </div>
      }
    </div>

    <!-- Relationship Modal -->
    @if (relModal.open) {
      <div class="modal-overlay" (click)="closeRelModal()">
        <div class="modal" (click)="$event.stopPropagation()" style="max-width:500px;">
          <div class="modal-header">
            <h2>{{ relModal.title }}</h2>
            <button class="btn btn-icon" (click)="closeRelModal()">
              <span class="material-icons">close</span>
            </button>
          </div>
          <div class="modal-body">

            <!-- New child form -->
            @if (relModal.type === 'new-child') {
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">First Name *</label>
                  <input class="form-control" [(ngModel)]="newChild.first_name" placeholder="First name">
                </div>
                <div class="form-group">
                  <label class="form-label">Last Name</label>
                  <input class="form-control" [(ngModel)]="newChild.last_name" placeholder="Last name">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Gender</label>
                  <select class="form-control" [(ngModel)]="newChild.gender">
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Status</label>
                  <select class="form-control" [(ngModel)]="newChild.is_alive">
                    <option value="1">Living</option>
                    <option value="0">Deceased</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Date of Birth</label>
                  <input class="form-control" type="date" [(ngModel)]="newChild.dob">
                </div>
                <div class="form-group">
                  <label class="form-label">Generation</label>
                  <div class="form-control" style="background:var(--bg-primary);color:var(--accent-light);cursor:default;">
                    Gen {{ (person?.generation || 0) + 1 }} <span style="font-size:0.78rem;color:var(--text-muted);"> (auto-calculated)</span>
                  </div>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Birthplace</label>
                <input class="form-control" [(ngModel)]="newChild.birthplace" placeholder="Village, City">
              </div>
              <div class="form-group">
                <label class="form-label">Occupation</label>
                <input class="form-control" [(ngModel)]="newChild.occupation" placeholder="Occupation">
              </div>
            }

            <!-- Link existing (child / parent / spouse) -->
            @if (relModal.type !== 'new-child') {
              <div class="form-group">
                <label class="form-label">Search by name</label>
                <input class="form-control" [(ngModel)]="searchQ" (input)="searchPersons()" placeholder="Type to search…">
              </div>

              @if (relModal.type === 'spouse') {
                <div class="form-group">
                  <label class="form-label">Married On (optional)</label>
                  <input class="form-control" type="date" [(ngModel)]="marriedOn">
                </div>
              }

              <div style="max-height:240px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-top:8px;">
                @if (searchResults.length === 0 && searchQ.length > 1) {
                  <div style="padding:16px;text-align:center;color:var(--text-muted);font-size:0.85rem;">No results</div>
                }
                @for (r of searchResults; track r.id) {
                  <div class="search-result" (click)="selectPerson(r)">
                    <div>
                      <div style="font-weight:500;">{{ fullName(r) }}</div>
                      <div style="font-size:0.75rem;color:var(--text-muted);">
                        Gen {{ r.generation }} · {{ r.family_name }} · {{ r.gender }}
                        @if (selectedId === r.id) { <span style="color:#10b981;"> ✓ Selected</span> }
                      </div>
                    </div>
                    <span class="badge" [class]="r.is_alive?'badge-alive':'badge-dec'">
                      {{ r.is_alive ? 'Living' : 'Deceased' }}
                    </span>
                  </div>
                }
              </div>
              @if (selectedId) {
                <div style="margin-top:10px;padding:10px;background:var(--accent-dim);border-radius:8px;font-size:0.85rem;color:var(--accent-light);">
                  ✓ Selected: {{ selectedName }}
                </div>
              }
            }
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeRelModal()">Cancel</button>
            <button class="btn btn-primary" (click)="saveRelationship()" [disabled]="saving">
              {{ saving ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Edit Person Modal -->
    @if (showEditModal) {
      <app-person-form-modal
        [person]="person"
        [families]="families"
        (close)="showEditModal = false"
        (saved)="onEditSaved()">
      </app-person-form-modal>
    }
  `
})
export class PersonDetailComponent implements OnInit {
  person: Person | null = null;
  families: Family[] = [];
  loading = true;
  saving = false;
  currentId!: number;

  relModal = { open: false, type: '', title: '' };
  searchQ = '';
  searchResults: Person[] = [];
  selectedId: number | null = null;
  selectedName = '';
  marriedOn = '';

  newChild: any = { first_name: '', last_name: '', gender: 'male', is_alive: '1', dob: '', birthplace: '', occupation: '', generation: 2 };

  showEditModal = false;

  private searchTimer: any;

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.api.getFamilies().subscribe(r => this.families = r.data);
    this.route.paramMap.subscribe(params => {
      const id = +params.get('id')!;
      if (id) {
        this.currentId = id;
        this.load();
      }
    });
  }

  load() {
    this.loading = true;
    this.api.getPerson(this.currentId).subscribe({
      next: (res) => { this.person = res.data; this.loading = false; },
      error: () => this.loading = false
    });
  }

  onEditSaved() {
    this.showEditModal = false;
    this.load();
  }

  fullName(p: any) { return `${p.first_name} ${p.last_name || ''}`.trim(); }
  goTo(id: number) { this.router.navigate(['/persons', id]); }

  openRelModal(type: string) {
    const titles: any = {
      'new-child': 'Add New Child',
      'child':     'Link Existing Person as Child',
      'parent':    'Link Existing Person as Parent',
      'spouse':    'Add Spouse'
    };
    this.relModal = { open: true, type, title: titles[type] };
    this.searchQ = ''; this.searchResults = []; this.selectedId = null;
    this.selectedName = ''; this.marriedOn = '';
    if (type === 'new-child') {
      this.newChild = { first_name: '', last_name: '', gender: 'male', is_alive: '1',
        dob: '', birthplace: '', occupation: '', generation: (this.person?.generation || 0) + 1 };
    }
  }

  closeRelModal() { this.relModal.open = false; }

  searchPersons() {
    clearTimeout(this.searchTimer);
    if (this.searchQ.length < 2) { this.searchResults = []; return; }
    this.searchTimer = setTimeout(() => {
      this.api.getPersons({ q: this.searchQ }).subscribe(res => {
        this.searchResults = res.data.filter((p: Person) => p.id !== this.person?.id);
      });
    }, 300);
  }

  selectPerson(p: Person) {
    this.selectedId = p.id;
    this.selectedName = this.fullName(p);
  }

  saveRelationship() {
    const type = this.relModal.type;

    if (type === 'new-child') {
      if (!this.newChild.first_name.trim()) { this.toast.show('First name required', 'error'); return; }
      this.saving = true;
      const fd = new FormData();
      fd.append('first_name', this.newChild.first_name);
      if (this.newChild.last_name)   fd.append('last_name',   this.newChild.last_name);
      if (this.newChild.dob)         fd.append('dob',         this.newChild.dob);
      if (this.newChild.birthplace)  fd.append('birthplace',  this.newChild.birthplace);
      if (this.newChild.occupation)  fd.append('occupation',  this.newChild.occupation);
      fd.append('gender',      this.newChild.gender);
      fd.append('is_alive',    this.newChild.is_alive);
      fd.append('generation',  String(this.newChild.generation));
      fd.append('family_id',   String(this.person?.family_id || ''));
      fd.append('parent_ids',  String(this.person?.id));

      this.api.createPerson(fd).subscribe({
        next: () => { this.toast.show('Child added!'); this.closeRelModal(); this.load(); this.saving = false; },
        error: err => { this.toast.show(err?.error?.error || 'Failed', 'error'); this.saving = false; }
      });
      return;
    }

    if (!this.selectedId) { this.toast.show('Please select a person', 'error'); return; }
    this.saving = true;

    let obs: any;
    if (type === 'child') {
      obs = this.api.addRelationship(this.person!.id, this.selectedId);
    } else if (type === 'parent') {
      obs = this.api.addRelationship(this.selectedId, this.person!.id);
    } else if (type === 'spouse') {
      obs = this.api.addMarriage(this.person!.id, this.selectedId, this.marriedOn || undefined);
    }

    obs.subscribe({
      next: () => { this.toast.show('Saved!'); this.closeRelModal(); this.load(); this.saving = false; },
      error: (err: any) => { this.toast.show(err?.error?.error || 'Failed', 'error'); this.saving = false; }
    });
  }

  removeRelationship(parentId: number, childId: number, label: string) {
    if (!confirm(`Remove this ${label} relationship?`)) return;
    // Call DELETE on relationships
    this.api.removeRelationship(parentId, childId).subscribe({
      next: () => { this.toast.show('Relationship removed'); this.load(); },
      error: err => this.toast.show(err?.error?.error || 'Failed', 'error')
    });
  }

  removeMarriage(spouseId: number) {
    if (!confirm('Remove this marriage?')) return;
    this.api.removeMarriage(this.person!.id, spouseId).subscribe({
      next: () => { this.toast.show('Marriage removed'); this.load(); },
      error: err => this.toast.show(err?.error?.error || 'Failed', 'error')
    });
  }
}
