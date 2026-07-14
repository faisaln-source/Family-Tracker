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

    /* Quick-view drawer */
    .qv-backdrop { position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:400;
      animation:fadeIn 0.18s ease; }
    .qv-drawer { position:fixed;top:0;right:0;bottom:0;width:min(440px,100vw);
      background:var(--bg-card);border-left:1px solid var(--border-accent);
      z-index:401;overflow-y:auto;display:flex;flex-direction:column;
      animation:slideInRight 0.22s cubic-bezier(.4,0,.2,1); }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    @keyframes slideInRight { from{transform:translateX(100%)} to{transform:translateX(0)} }
    .qv-header { display:flex;align-items:center;gap:12px;padding:18px 20px 14px;
      border-bottom:1px solid var(--border);position:sticky;top:0;
      background:var(--bg-card);z-index:1; }
    .qv-body { padding:20px;flex:1; }
    .qv-field { margin-bottom:12px; }
    .qv-label { font-size:0.72rem;color:var(--text-muted);margin-bottom:2px;text-transform:uppercase;letter-spacing:.04em; }
    .qv-value { font-size:0.9rem;color:var(--text-primary); }
    .qv-section { margin-top:18px; }
    .qv-section-title { font-size:0.78rem;font-weight:600;color:var(--text-muted);
      text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px; }
    .qv-chip { display:inline-flex;align-items:center;gap:6px;padding:4px 10px;
      border-radius:99px;font-size:0.8rem;font-weight:500;margin:3px;
      background:var(--bg-hover);border:1px solid var(--border);cursor:pointer;
      transition:all 0.15s; }
    .qv-chip:hover { border-color:var(--accent);color:var(--accent-light); }
  `],
  template: `
    <div style="max-width:920px;margin:0 auto;">
      <a class="btn btn-secondary btn-sm" routerLink="/persons" style="margin-bottom:20px;display:inline-flex;">
        <span class="material-icons" style="font-size:16px;">arrow_back</span> Back
      </a>

      @if (loading) { <div class="loading-spinner"><div class="spinner"></div></div> }

      @if (!loading && person) {
        <!-- Hero -->
        <div class="card" style="display:flex;flex-wrap:wrap;gap:28px;align-items:flex-start;margin-bottom:22px;">
          <div style="position:relative;">
            @if (person.photo_url) {
              <img [src]="api.getImageUrl(person.photo_url)"
                   style="width:110px;height:110px;border-radius:50%;object-fit:cover;border:3px solid var(--border-accent);"
                   [alt]="person.first_name"
                   (error)="$any($event.target).style.display='none'">
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
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;background:var(--bg-hover);padding:14px;border-radius:8px;">
              <div>
                <div style="color:var(--text-muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px;">Born</div>
                <div style="font-size:0.9rem;">{{ person.dob || '—' }}</div>
              </div>
              <div>
                <div style="color:var(--text-muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px;">Birthplace</div>
                <div style="font-size:0.9rem;">{{ person.birthplace || '—' }}</div>
              </div>
              <div>
                <div style="color:var(--text-muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px;">Occupation</div>
                <div style="font-size:0.9rem;">{{ person.occupation || '—' }}</div>
              </div>
              <div>
                <div style="color:var(--text-muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px;">Phone</div>
                <div style="font-size:0.9rem;">
                  @if (person.phone) {
                    <div style="display:flex;align-items:center;gap:4px;">
                      <span class="material-icons" style="font-size:13px;color:var(--accent);">phone</span>
                      <a [href]="'tel:' + person.phone" style="color:inherit;text-decoration:none;">{{ person.phone }}</a>
                    </div>
                  } @else {
                    <span style="color:var(--text-muted);">—</span>
                  }
                </div>
              </div>
              @if (person.dod) {
                <div style="grid-column:1/-1;">
                  <div style="color:var(--text-muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px;">Died</div>
                  <div style="font-size:0.9rem;">{{ person.dod }}</div>
                </div>
              }
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
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:18px;">

          <!-- Parents -->
          <div class="card">
            <h3 style="margin-bottom:14px;display:flex;align-items:center;gap:8px;">
              <span class="material-icons" style="color:var(--accent-light);">supervisor_account</span>
              Parents ({{ person.parents?.length || 0 }})
            </h3>
            @for (p of person.parents; track p.id) {
              <div class="person-mini">
                <span (click)="goTo(p.id)" style="cursor:pointer;flex:1;">{{ fullName(p) }}</span>
                <div style="display:flex;gap:12px;align-items:center;">
                  <button class="btn btn-icon" style="padding:4px;" title="View details" (click)="openQuickView(p.id)">
                    <span class="material-icons" style="font-size:16px;color:var(--accent-light);">open_in_new</span>
                  </button>
                  <button class="btn btn-icon" style="padding:4px;" title="Remove parent"
                          (click)="removeRelationship(p.id, person!.id, 'parent')">
                    <span class="material-icons" style="font-size:16px;color:#ef4444;">close</span>
                  </button>
                </div>
              </div>
            }
            <div style="display:flex;gap:8px;margin-top:6px;">
              <button class="add-rel-btn" style="flex:1;" (click)="openRelModal('new-parent')">
                <span class="material-icons" style="font-size:16px;">person_add</span> Add New
              </button>
              <button class="add-rel-btn" style="flex:1;" (click)="openRelModal('parent')">
                <span class="material-icons" style="font-size:16px;">link</span> Link Existing
              </button>
            </div>
          </div>

          <!-- Spouses -->
          <div class="card">
            <h3 style="margin-bottom:14px;display:flex;align-items:center;gap:8px;">
              <span class="material-icons" style="color:#f472b6;">favorite</span>
              Spouse(s) ({{ person.spouses?.length || 0 }})
            </h3>
            @for (s of person.spouses; track s.id) {
              <div class="person-mini">
                <span (click)="goTo(s.id)" style="cursor:pointer;flex:1;">{{ fullName(s) }}</span>
                @if (s.married_on) { <span style="font-size:0.72rem;color:var(--text-muted);margin-right:4px;">{{ s.married_on }}</span> }
                <div style="display:flex;gap:12px;align-items:center;">
                  <button class="btn btn-icon" style="padding:4px;" title="View details" (click)="openQuickView(s.id)">
                    <span class="material-icons" style="font-size:16px;color:var(--accent-light);">open_in_new</span>
                  </button>
                  <button class="btn btn-icon" style="padding:4px;" title="Remove spouse"
                          (click)="removeMarriage(s.id)">
                    <span class="material-icons" style="font-size:16px;color:#ef4444;">close</span>
                  </button>
                </div>
              </div>
            }
            <div style="display:flex;gap:8px;margin-top:6px;">
              <button class="add-rel-btn" style="flex:1;" (click)="openRelModal('new-spouse')">
                <span class="material-icons" style="font-size:16px;">person_add</span> Add New
              </button>
              <button class="add-rel-btn" style="flex:1;" (click)="openRelModal('spouse')">
                <span class="material-icons" style="font-size:16px;">link</span> Link Existing
              </button>
            </div>
          </div>

          <!-- Siblings -->
          <div class="card">
            <h3 style="margin-bottom:14px;display:flex;align-items:center;gap:8px;">
              <span class="material-icons" style="color:#60a5fa;">group</span>
              Siblings ({{ person.siblings?.length || 0 }})
            </h3>
            @for (s of person.siblings; track s.id) {
              <div class="person-mini">
                <span (click)="goTo(s.id)" style="cursor:pointer;flex:1;">{{ fullName(s) }}</span>
                <div style="display:flex;gap:12px;align-items:center;">
                  <button class="btn btn-icon" style="padding:4px;" title="View details" (click)="openQuickView(s.id)">
                    <span class="material-icons" style="font-size:16px;color:var(--accent-light);">open_in_new</span>
                  </button>
                </div>
              </div>
            }
            @if (!person.siblings?.length) { <p style="font-size:0.84rem;">No siblings recorded</p> }
            <div style="display:flex;gap:8px;margin-top:6px;">
              <button class="add-rel-btn" style="flex:1;" (click)="openRelModal('new-sibling')">
                <span class="material-icons" style="font-size:16px;">person_add</span> Add New
              </button>
              <button class="add-rel-btn" style="flex:1;" (click)="openRelModal('sibling')">
                <span class="material-icons" style="font-size:16px;">link</span> Link Existing
              </button>
            </div>
          </div>

          <!-- Children -->
          <div class="card">
            <h3 style="margin-bottom:14px;display:flex;align-items:center;gap:8px;">
              <span class="material-icons" style="color:#10b981;">child_care</span>
              Children ({{ person.children?.length || 0 }})
            </h3>
            @for (c of person.children; track c.id) {
              <div class="person-mini">
                <span (click)="goTo(c.id)" style="cursor:pointer;flex:1;">{{ fullName(c) }}</span>
                <span class="badge badge-gen" style="margin:0 4px;font-size:0.65rem;">Gen {{ c.generation }}</span>
                <div style="display:flex;gap:12px;align-items:center;">
                  <button class="btn btn-icon" style="padding:4px;" title="View details" (click)="openQuickView(c.id)">
                    <span class="material-icons" style="font-size:16px;color:var(--accent-light);">open_in_new</span>
                  </button>
                  <button class="btn btn-icon" style="padding:4px;" title="Remove child"
                          (click)="removeRelationship(person!.id, c.id, 'child')">
                    <span class="material-icons" style="font-size:16px;color:#ef4444;">close</span>
                  </button>
                </div>
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

            <!-- New member form (child / spouse / parent / sibling) -->
            @if (['new-child','new-spouse','new-parent','new-sibling'].includes(relModal.type)) {
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">First Name *</label>
                  <input class="form-control" [(ngModel)]="newMember.first_name" placeholder="First name">
                </div>
                <div class="form-group">
                  <label class="form-label">Last Name</label>
                  <input class="form-control" [(ngModel)]="newMember.last_name" placeholder="Last name">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Gender</label>
                  <select class="form-control" [(ngModel)]="newMember.gender">
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Status</label>
                  <select class="form-control" [(ngModel)]="newMember.is_alive">
                    <option value="1">Living</option>
                    <option value="0">Deceased</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Date of Birth</label>
                  <input class="form-control" type="date" [(ngModel)]="newMember.dob">
                </div>
                <div class="form-group">
                  <label class="form-label">Phone</label>
                  <input class="form-control" [(ngModel)]="newMember.phone" placeholder="+91 98765…" type="tel">
                </div>
              </div>
              @if (relModal.type === 'new-spouse') {
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Married On (optional)</label>
                    <input class="form-control" type="date" [(ngModel)]="marriedOn">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Generation</label>
                    <div class="form-control" style="background:var(--bg-primary);color:var(--accent-light);cursor:default;">
                      Gen {{ person?.generation }} <span style="font-size:0.78rem;color:var(--text-muted);"> (same gen)</span>
                    </div>
                  </div>
                </div>
              }
              @if (relModal.type === 'new-child') {
                <div class="form-group">
                  <label class="form-label">Generation</label>
                  <div class="form-control" style="background:var(--bg-primary);color:var(--accent-light);cursor:default;">
                    Gen {{ (person?.generation || 0) + 1 }} <span style="font-size:0.78rem;color:var(--text-muted);"> (auto-calculated)</span>
                  </div>
                </div>
              }
              @if (relModal.type === 'new-parent') {
                <div class="form-group">
                  <label class="form-label">Generation</label>
                  <div class="form-control" style="background:var(--bg-primary);color:var(--accent-light);cursor:default;">
                    Gen {{ (person?.generation || 2) - 1 }} <span style="font-size:0.78rem;color:var(--text-muted);"> (one gen above)</span>
                  </div>
                </div>
              }
              @if (relModal.type === 'new-sibling') {
                <div class="form-group">
                  <label class="form-label">Generation</label>
                  <div class="form-control" style="background:var(--bg-primary);color:var(--accent-light);cursor:default;">
                    Gen {{ person?.generation }} <span style="font-size:0.78rem;color:var(--text-muted);"> (same gen)</span>
                  </div>
                </div>
              }
              <div class="form-group">
                <label class="form-label">Birthplace</label>
                <input class="form-control" [(ngModel)]="newMember.birthplace" placeholder="Village, City">
              </div>
              <div class="form-group">
                <label class="form-label">Occupation</label>
                <input class="form-control" [(ngModel)]="newMember.occupation" placeholder="Occupation">
              </div>
            }

            <!-- Link existing (child / parent / spouse / sibling) -->
            @if (!['new-child','new-spouse','new-parent','new-sibling'].includes(relModal.type)) {
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

  <!-- ── QUICK VIEW DRAWER (outside content div so position:fixed works) ── -->
  @if (quickViewPerson || quickViewLoading) {
    <div class="qv-backdrop" (click)="quickViewPerson = null; quickViewLoading = false"></div>
    <div class="qv-drawer">

      @if (quickViewLoading) {
        <div style="display:flex;align-items:center;justify-content:center;height:100%;">
          <div class="loading-spinner"><div class="spinner"></div><span>Loading...</span></div>
        </div>
      }

      @if (quickViewPerson && !quickViewLoading) {
        <!-- Header -->
        <div class="qv-header">
          @if (quickViewPerson.photo_url) {
            <img [src]="api.getImageUrl(quickViewPerson.photo_url)"
                 style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid var(--border-accent);"
                 [alt]="quickViewPerson.first_name"
                 (error)="$any($event.target).style.display='none'">
          } @else {
            <div style="width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;
                        font-size:1.4rem;font-weight:700;color:white;flex-shrink:0;"
                 [style.background]="quickViewPerson.family_color || '#7c6cfa'">
              {{ quickViewPerson.first_name[0] }}{{ quickViewPerson.last_name?.[0] || '' }}
            </div>
          }
          <div style="flex:1;min-width:0;">
            <div style="font-size:1.1rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              {{ quickViewPerson.first_name }} {{ quickViewPerson.last_name }}
            </div>
            <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px;">
              <span class="badge badge-gen" style="font-size:0.7rem;">Gen {{ quickViewPerson.generation }}</span>
              <span class="badge" [class]="quickViewPerson.gender==='male'?'badge-male':'badge-female'" style="font-size:0.7rem;">
                {{ quickViewPerson.gender==='male' ? '♂ Male' : '♀ Female' }}
              </span>
              <span class="badge" [class]="quickViewPerson.is_alive?'badge-alive':'badge-dec'" style="font-size:0.7rem;">
                {{ quickViewPerson.is_alive ? '● Living' : '⚫ Deceased' }}
              </span>
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;">
            <button class="btn btn-primary btn-sm" (click)="goTo(quickViewPerson.id); quickViewPerson = null">
              <span class="material-icons" style="font-size:15px;">open_in_new</span> Profile
            </button>
            <button class="btn btn-icon" (click)="quickViewPerson = null">
              <span class="material-icons">close</span>
            </button>
          </div>
        </div>

        <!-- Body -->
        <div class="qv-body">
          <!-- Key info grid -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:4px;">
            @if (quickViewPerson.dob) {
              <div class="qv-field">
                <div class="qv-label">Born</div>
                <div class="qv-value">{{ quickViewPerson.dob }}</div>
              </div>
            }
            @if (quickViewPerson.dod) {
              <div class="qv-field">
                <div class="qv-label">Died</div>
                <div class="qv-value">{{ quickViewPerson.dod }}</div>
              </div>
            }
            @if (quickViewPerson.birthplace) {
              <div class="qv-field">
                <div class="qv-label">Birthplace</div>
                <div class="qv-value">{{ quickViewPerson.birthplace }}</div>
              </div>
            }
            @if (quickViewPerson.occupation) {
              <div class="qv-field">
                <div class="qv-label">Occupation</div>
                <div class="qv-value">{{ quickViewPerson.occupation }}</div>
              </div>
            }
            @if (quickViewPerson.phone) {
              <div class="qv-field">
                <div class="qv-label">Phone</div>
                <div class="qv-value" style="display:flex;align-items:center;gap:4px;">
                  <span class="material-icons" style="font-size:13px;color:var(--accent);">phone</span>
                  <a [href]="'tel:' + quickViewPerson.phone" style="color:var(--accent-light);">{{ quickViewPerson.phone }}</a>
                </div>
              </div>
            }
            @if (quickViewPerson.family_name) {
              <div class="qv-field">
                <div class="qv-label">Family</div>
                <div class="qv-value" style="display:flex;align-items:center;gap:6px;">
                  <span style="width:9px;height:9px;border-radius:50%;display:inline-block;"
                        [style.background]="quickViewPerson.family_color || '#7c6cfa'"></span>
                  {{ quickViewPerson.family_name }}
                </div>
              </div>
            }
          </div>

          @if (quickViewPerson.bio) {
            <div style="margin:14px 0;padding:12px;background:var(--bg-hover);border-radius:8px;
                        font-size:0.85rem;line-height:1.6;color:var(--text-primary);">
              {{ quickViewPerson.bio }}
            </div>
          }

          <!-- Parents -->
          @if (quickViewPerson.parents?.length) {
            <div class="qv-section">
              <div class="qv-section-title">Parents</div>
              @for (p of quickViewPerson.parents; track p.id) {
                <span class="qv-chip" (click)="openQuickView(p.id)">
                  <span class="material-icons" style="font-size:13px;color:var(--accent-light);">person</span>
                  {{ fullName(p) }}
                </span>
              }
            </div>
          }

          <!-- Spouses -->
          @if (quickViewPerson.spouses?.length) {
            <div class="qv-section">
              <div class="qv-section-title">Spouse(s)</div>
              @for (s of quickViewPerson.spouses; track s.id) {
                <span class="qv-chip" (click)="openQuickView(s.id)">
                  <span class="material-icons" style="font-size:13px;color:#f472b6;">favorite</span>
                  {{ fullName(s) }}
                  @if (s.married_on) { <span style="font-size:0.7rem;color:var(--text-muted);">· {{ s.married_on }}</span> }
                </span>
              }
            </div>
          }

          <!-- Siblings -->
          @if (quickViewPerson.siblings?.length) {
            <div class="qv-section">
              <div class="qv-section-title">Siblings</div>
              @for (s of quickViewPerson.siblings; track s.id) {
                <span class="qv-chip" (click)="openQuickView(s.id)">
                  <span class="material-icons" style="font-size:13px;color:#60a5fa;">group</span>
                  {{ fullName(s) }}
                </span>
              }
            </div>
          }

          <!-- Children -->
          @if (quickViewPerson.children?.length) {
            <div class="qv-section">
              <div class="qv-section-title">Children</div>
              @for (c of quickViewPerson.children; track c.id) {
                <span class="qv-chip" (click)="openQuickView(c.id)">
                  <span class="material-icons" style="font-size:13px;color:#10b981;">child_care</span>
                  {{ fullName(c) }}
                  <span style="font-size:0.7rem;color:var(--text-muted);">Gen {{ c.generation }}</span>
                </span>
              }
            </div>
          }

          @if (!quickViewPerson.parents?.length && !quickViewPerson.spouses?.length &&
               !quickViewPerson.siblings?.length && !quickViewPerson.children?.length) {
            <div style="margin-top:24px;text-align:center;color:var(--text-muted);font-size:0.85rem;">
              No relationships recorded
            </div>
          }
        </div>
      }
    </div>
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

  newMember: any = { first_name: '', last_name: '', gender: 'male', is_alive: '1', dob: '', birthplace: '', occupation: '', phone: '' };

  showEditModal = false;
  quickViewPerson: Person | null = null;
  quickViewLoading = false;

  private searchTimer: any;

  constructor(
    public api: ApiService,
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

  openQuickView(id: number) {
    this.quickViewLoading = true;
    this.quickViewPerson = null;
    this.api.getPerson(id).subscribe({
      next: (res) => { this.quickViewPerson = res.data; this.quickViewLoading = false; },
      error: () => { this.quickViewLoading = false; }
    });
  }

  openRelModal(type: string) {
    const titles: any = {
      'new-child':   'Add New Child',
      'new-spouse':  'Add New Spouse',
      'new-parent':  'Add New Parent',
      'new-sibling': 'Add New Sibling',
      'child':       'Link Existing Person as Child',
      'parent':      'Link Existing Person as Parent',
      'spouse':      'Link Existing Spouse',
      'sibling':     'Link Existing Sibling'
    };
    this.relModal = { open: true, type, title: titles[type] };
    this.searchQ = ''; this.searchResults = []; this.selectedId = null;
    this.selectedName = ''; this.marriedOn = '';
    if (['new-child','new-spouse','new-parent','new-sibling'].includes(type)) {
      this.newMember = {
        first_name: '', last_name: '',
        gender: type === 'new-spouse' ? (this.person?.gender === 'male' ? 'female' : 'male') : 'male',
        is_alive: '1', dob: '', birthplace: '', occupation: '', phone: ''
      };
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

    if (['new-child','new-spouse','new-parent','new-sibling'].includes(type)) {
      if (!this.newMember.first_name.trim()) { this.toast.show('First name required', 'error'); return; }
      this.saving = true;
      const genMap: any = {
        'new-child':   (this.person?.generation || 0) + 1,
        'new-spouse':  this.person?.generation || 1,
        'new-parent':  Math.max(1, (this.person?.generation || 2) - 1),
        'new-sibling': this.person?.generation || 1
      };
      const generation = genMap[type];
      const fd = new FormData();
      fd.append('first_name', this.newMember.first_name);
      if (this.newMember.last_name)   fd.append('last_name',   this.newMember.last_name);
      if (this.newMember.dob)         fd.append('dob',         this.newMember.dob);
      if (this.newMember.birthplace)  fd.append('birthplace',  this.newMember.birthplace);
      if (this.newMember.occupation)  fd.append('occupation',  this.newMember.occupation);
      if (this.newMember.phone)       fd.append('phone',       this.newMember.phone);
      fd.append('gender',     this.newMember.gender);
      fd.append('is_alive',   this.newMember.is_alive);
      fd.append('generation', String(generation));
      fd.append('family_id',  String(this.person?.family_id || ''));
      // For new-child: link current person as parent
      if (type === 'new-child') fd.append('parent_ids', String(this.person?.id));
      // For new-sibling: share same parents as current person
      if (type === 'new-sibling' && this.person?.parents?.length) {
        fd.append('parent_ids', this.person.parents.map((p: any) => p.id).join(','));
      }

      this.api.createPerson(fd).subscribe({
        next: (res: any) => {
          const newId = res?.data?.id;
          if (type === 'new-spouse' && newId) {
            this.api.addMarriage(this.person!.id, newId, this.marriedOn || undefined).subscribe({
              next: () => { this.toast.show('Spouse added!'); this.closeRelModal(); this.load(); this.saving = false; },
              error: err => { this.toast.show(err?.error?.error || 'Person created but marriage link failed', 'error'); this.saving = false; }
            });
          } else if (type === 'new-parent' && newId) {
            // Link new person as parent of current person
            this.api.addRelationship(newId, this.person!.id).subscribe({
              next: () => { this.toast.show('Parent added!'); this.closeRelModal(); this.load(); this.saving = false; },
              error: err => { this.toast.show(err?.error?.error || 'Person created but parent link failed', 'error'); this.saving = false; }
            });
          } else {
            const msg = type === 'new-sibling' ? 'Sibling added!' : 'Child added!';
            this.toast.show(msg); this.closeRelModal(); this.load(); this.saving = false;
          }
        },
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
    } else if (type === 'sibling') {
      // Link as sibling by adding this person to all of current person's parents
      const parentIds: number[] = (this.person?.parents || []).map((p: any) => p.id);
      if (parentIds.length === 0) {
        this.toast.show('No parents found. Add a parent first to link siblings.', 'error');
        this.saving = false; return;
      }
      Promise.all(parentIds.map(pid => this.api.addRelationship(pid, this.selectedId!).toPromise().catch(() => {})))
        .then(() => { this.toast.show('Sibling linked!'); this.closeRelModal(); this.load(); this.saving = false; });
      return;
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
