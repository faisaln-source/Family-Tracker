import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';

const API = 'https://family-tracker-yrkm.onrender.com/api';

export interface Person {
  id: number;
  family_id: number;
  first_name: string;
  last_name: string;
  gender: 'male' | 'female' | 'other';
  dob?: string;
  dod?: string;
  birthplace?: string;
  occupation?: string;
  bio?: string;
  photo_url?: string;
  phone?: string;
  generation: number;
  is_alive: number;
  family_name?: string;
  family_color?: string;
  parents?: Person[];
  children?: Person[];
  siblings?: Person[];
  spouses?: any[];
  marriages_raw?: string;
}

export interface Family {
  id: number;
  family_name: string;
  origin?: string;
  description?: string;
  color: string;
  image_url?: string;
  member_count?: number;
  members?: Person[];
}

export interface TreeNode extends Person {
  children: TreeNode[];
  spouses?: any[];
  depth?: number;
}

export interface Stats {
  totalPersons: number;
  totalFamilies: number;
  totalMarriages: number;
  alive: number;
  deceased: number;
  maxGeneration: number;
  byGeneration: { generation: number; count: number; male: number; female: number }[];
  byFamily: { family_name: string; color: string; count: number }[];
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  public updates$ = new Subject<any>();

  constructor(private http: HttpClient, private zone: NgZone) {
    this.initSSE();
  }

  private initSSE() {
    const eventSource = new EventSource(`${API.replace('/api', '')}/api/stream`);
    eventSource.onmessage = (event) => {
      this.zone.run(() => {
        try {
          const data = JSON.parse(event.data);
          this.updates$.next(data);
        } catch (e) {}
      });
    };
    eventSource.onerror = (err) => {
      eventSource.close();
      setTimeout(() => this.initSSE(), 5000);
    };
  }

  // ── Families ──────────────────────────────────────────────────────────
  getFamilies(): Observable<{ data: Family[] }>         { return this.http.get<any>(`${API}/families`); }
  getFamily(id: number): Observable<{ data: Family }>   { return this.http.get<any>(`${API}/families/${id}`); }
  createFamily(formData: FormData): Observable<{ data: Family }> { return this.http.post<any>(`${API}/families`, formData); }
  updateFamily(id: number, formData: FormData)           { return this.http.put<any>(`${API}/families/${id}`, formData); }
  deleteFamily(id: number)                               { return this.http.delete<any>(`${API}/families/${id}`); }

  // ── Persons ───────────────────────────────────────────────────────────
  getPersons(filters?: any): Observable<{ data: Person[]; total: number }> {
    let params = new HttpParams();
    if (filters) Object.keys(filters).forEach(k => { if (filters[k] !== null && filters[k] !== undefined && filters[k] !== '') params = params.set(k, filters[k]); });
    return this.http.get<any>(`${API}/persons`, { params });
  }
  getPerson(id: number): Observable<{ data: Person }>      { return this.http.get<any>(`${API}/persons/${id}`); }
  createPerson(formData: FormData): Observable<{ data: Person }> { return this.http.post<any>(`${API}/persons`, formData); }
  updatePerson(id: number, formData: FormData)             { return this.http.put<any>(`${API}/persons/${id}`, formData); }
  deletePerson(id: number)                                 { return this.http.delete<any>(`${API}/persons/${id}`); }
  getByGeneration(gen: number): Observable<any>            { return this.http.get<any>(`${API}/persons/generation/${gen}`); }
  addRelationship(parent_id: number, child_id: number)     { return this.http.post<any>(`${API}/persons/relationships`, { parent_id, child_id }); }
  addMarriage(p1: number, p2: number, married_on?: string) { return this.http.post<any>(`${API}/persons/marriages`, { person1_id: p1, person2_id: p2, married_on }); }
  removeRelationship(parent_id: number, child_id: number)  { return this.http.delete<any>(`${API}/persons/relationships`, { body: { parent_id, child_id } }); }
  removeMarriage(p1: number, p2: number)                   { return this.http.delete<any>(`${API}/persons/marriages`, { body: { person1_id: p1, person2_id: p2 } }); }

  // ── Tree ──────────────────────────────────────────────────────────────
  getStats(): Observable<{ data: Stats }>                    { return this.http.get<any>(`${API}/tree/stats`); }
  getAllTrees(): Observable<any>                              { return this.http.get<any>(`${API}/tree/all`); }
  getFamilyTree(familyId: number): Observable<any>           { return this.http.get<any>(`${API}/tree/family/${familyId}`); }
  getAncestorTree(personId: number): Observable<any>         { return this.http.get<any>(`${API}/tree/ancestor/${personId}`); }
  getAncestors(personId: number): Observable<any>            { return this.http.get<any>(`${API}/tree/ancestors/${personId}`); }
  recalculateGenerations(): Observable<any>                  { return this.http.post<any>(`${API}/tree/recalculate-generations`, {}); }

  // ── Helpers ───────────────────────────────────────────────────────────
  getImageUrl(photoUrl?: string): string | null {
    if (!photoUrl) return null;
    if (photoUrl.startsWith('http')) return photoUrl;
    const base = API.replace('/api', '');
    return `${base}${photoUrl}`;
  }
}
