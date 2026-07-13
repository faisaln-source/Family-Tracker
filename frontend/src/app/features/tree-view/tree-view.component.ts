// Family Tree View Component
import { Component, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Family } from '../../core/api.service';
import * as d3 from 'd3';

@Component({
  selector: 'app-tree-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Family Tree</h1>
        <p>Interactive visualization of your family lineage</p>
      </div>
      <div style="display:flex;gap:10px;align-items:center;">
        <select class="form-control" style="width:200px;" [(ngModel)]="selectedFamilyId" (change)="loadTree()">
          <option [value]="0">All Families</option>
          @for (f of families; track f.id) {
            <option [value]="f.id">{{ f.family_name }}</option>
          }
        </select>
        <button class="btn btn-secondary" (click)="fixGenerations()" [disabled]="fixing"
                title="Recalculate all generation numbers based on parent-child relationships">
          <span class="material-icons" style="font-size:16px;">autorenew</span>
          {{ fixing ? 'Fixing…' : 'Fix Generations' }}
        </button>
      </div>
    </div>

    @if (loading) {
      <div class="loading-spinner"><div class="spinner"></div><span>Building tree...</span></div>
    }

    @if (!loading && noData) {
      <div class="empty-state">
        <span class="material-icons">account_tree</span>
        <h3>No tree data</h3>
        <p>Add family members and set parent relationships to view the tree</p>
      </div>
    }

    <div class="tree-container" [style.display]="loading || noData ? 'none' : 'block'" style="height:75vh;">
      <div class="tree-controls">
        <button class="btn btn-icon" (click)="zoomIn()" title="Zoom In"><span class="material-icons">zoom_in</span></button>
        <button class="btn btn-icon" (click)="zoomOut()" title="Zoom Out"><span class="material-icons">zoom_out</span></button>
        <button class="btn btn-icon" (click)="resetZoom()" title="Reset"><span class="material-icons">fit_screen</span></button>
      </div>
      <svg #treeSvg style="width:100%;height:100%;"></svg>
    </div>

    <!-- Tooltip -->
    @if (tooltip) {
      <div class="card" style="position:fixed;z-index:300;padding:14px 18px;pointer-events:none;min-width:180px;border-color:var(--border-accent);"
           [style.left.px]="tooltip.x" [style.top.px]="tooltip.y">
        <div style="font-weight:600;">{{ tooltip.name }}</div>
        <div class="person-meta" style="margin-top:4px;">{{ tooltip.meta }}</div>
        @if (tooltip.family) {
          <div style="margin-top:6px;">
            <span class="badge badge-gen">{{ tooltip.family }}</span>
          </div>
        }
      </div>
    }
  `
})
export class TreeViewComponent implements OnInit, AfterViewInit {
  @ViewChild('treeSvg') treeSvgRef!: ElementRef<SVGElement>;

  families: Family[] = [];
  selectedFamilyId = 0;
  loading = true;
  noData = false;
  fixing = false;
  tooltip: any = null;

  private svg: any;
  private zoomBehavior: any;
  private currentZoom = 1;

  constructor(private api: ApiService, private router: Router, private route: ActivatedRoute) {}

  ngOnInit() {
    this.api.getFamilies().subscribe(res => {
      this.families = res.data;
      this.route.queryParams.subscribe(p => {
        if (p['family_id']) {
          this.selectedFamilyId = +p['family_id'];
        }
        this.loadTree();
      });
    });
  }

  ngAfterViewInit() {}

  loadTree() {
    this.loading = true;
    this.noData = false;
    const obs = this.selectedFamilyId
      ? this.api.getFamilyTree(+this.selectedFamilyId)
      : this.api.getAllTrees();

    obs.subscribe({
      next: (res) => {
        this.loading = false;
        const data = this.selectedFamilyId ? res.data : res.data;
        if (!data || (Array.isArray(data) && data.length === 0)) {
          this.noData = true; return;
        }
        setTimeout(() => this.renderTree(data), 100);
      },
      error: () => { this.loading = false; this.noData = true; }
    });
  }

  private renderTree(data: any) {
    const el = this.treeSvgRef?.nativeElement;
    if (!el) return;

    // Clear previous
    d3.select(el).selectAll('*').remove();

    const width  = el.clientWidth  || 1200;
    const NODE_W = 150, NODE_H = 60;
    const SP_GAP = 16;   // gap between the two spouse cards
    const H_GAP  = 60;   // horizontal breathing room between couples/nodes
    const V_GAP  = 110;  // vertical gap between generations

    // Flatten roots
    let roots: any[] = [];
    if (Array.isArray(data) && data[0]?.trees) {
      data.forEach((fam: any) => roots.push(...(fam.trees || [])));
    } else if (Array.isArray(data)) {
      roots = data;
    } else {
      roots = [data];
    }
    if (roots.length === 0) { this.noData = true; return; }

    const hierarchies = roots.map(r => d3.hierarchy(r, (d: any) => d.children?.length ? d.children : null));

    // Each slot is wide enough for a couple (2 cards + gap) + breathing room
    const slotW = NODE_W * 2 + SP_GAP + H_GAP;
    const treeLayout = d3.tree<any>().nodeSize([slotW, NODE_H + V_GAP]);
    hierarchies.forEach(h => treeLayout(h));

    // Offset trees horizontally so they don't overlap
    let xOffset = 0;
    hierarchies.forEach(h => {
      let minX = Infinity, maxX = -Infinity;
      h.descendants().forEach((n: any) => { if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x; });
      h.descendants().forEach((n: any) => { n.x = n.x - minX + xOffset; });
      xOffset += (maxX - minX + slotW) + 80;
    });

    const allNodes = hierarchies.flatMap(h => h.descendants());
    const allLinks = hierarchies.flatMap(h => h.links());

    const svg = d3.select(el);
    const g   = svg.append('g');

    this.zoomBehavior = d3.zoom<SVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => { g.attr('transform', event.transform); this.currentZoom = event.transform.k; });
    svg.call(this.zoomBehavior as any);

    // Center-X of a node (couple mid-point if has spouse, else card center)
    const cx = (d: any) => d.x + (d.data.spouses?.length ? NODE_W + SP_GAP / 2 : NODE_W / 2);

    // Draw parent→child curved links, originating from couple midpoint
    g.selectAll('.link')
      .data(allLinks)
      .join('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', 'rgba(124,108,250,0.35)')
      .attr('stroke-width', 2)
      .attr('d', (d: any) => {
        const sx = cx(d.source), sy = d.source.y + NODE_H;
        // TARGET explicitly points to the bloodline child's center
        const tx = d.target.x + NODE_W / 2;
        const ty = d.target.y;
        const my = sy + (ty - sy) * 0.5;
        return `M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`;
      });

    // Self reference so we can update tooltip inside node.each
    const self = this;

    // Draw node groups
    const node = g.selectAll('.node')
      .data(allNodes)
      .join('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

    // Helper: draw one person card at local x-offset inside the node group
    const drawCard = (
      parent: any, localX: number, person: any,
      accentColor: string, genLabel: string
    ) => {
      const cg = parent.append('g')
        .attr('transform', `translate(${localX},0)`)
        .style('cursor', 'pointer')
        .on('click', (event: MouseEvent) => {
          event.stopPropagation();
          this.router.navigate(['/persons', person.id]);
        })
        .on('mouseenter', (event: MouseEvent) => {
          self.tooltip = {
            x: event.clientX + 14, y: event.clientY - 10,
            name: `${person.first_name} ${person.last_name || ''}`.trim(),
            meta: [person.dob ? `Born: ${person.dob}` : '', person.birthplace || ''].filter(Boolean).join(' · '),
            family: person.family_name
          };
        })
        .on('mousemove', (event: MouseEvent) => {
          if (self.tooltip) self.tooltip = { ...self.tooltip, x: event.clientX + 14, y: event.clientY - 10 };
        })
        .on('mouseleave', () => { self.tooltip = null; });

      // Card background
      cg.append('rect')
        .attr('width', NODE_W).attr('height', NODE_H).attr('rx', 10)
        .attr('fill', '#161d2e').attr('stroke', accentColor).attr('stroke-width', 1.5);

      // Left accent bar
      cg.append('rect')
        .attr('width', 4).attr('height', NODE_H).attr('rx', 2).attr('fill', accentColor);

      // Name
      const fullName = `${person.first_name} ${person.last_name || ''}`.trim();
      cg.append('text')
        .attr('x', NODE_W / 2).attr('y', NODE_H / 2 - 7)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('fill', '#f0f2f8').attr('font-family', 'Inter, sans-serif')
        .attr('font-size', '12px').attr('font-weight', '600')
        .text(fullName.length > 17 ? fullName.substring(0, 15) + '…' : fullName);

      // Gen / status
      cg.append('text')
        .attr('x', NODE_W / 2).attr('y', NODE_H / 2 + 10)
        .attr('text-anchor', 'middle').attr('fill', '#9ba4be')
        .attr('font-family', 'Inter, sans-serif').attr('font-size', '10px')
        .text(genLabel);

      return cg;
    };


    node.each(function(d: any) {
      const p   = d.data;
      const col = p.family_color || '#7c6cfa';
      const grp = d3.select(this);

      // Main person card (always at x=0)
      drawCard(grp, 0, p, col, `Gen ${p.generation} · ${p.is_alive ? '🟢' : '⚫'}`);

      // Spouse card side-by-side
      if (p.spouses && p.spouses.length > 0) {
        const sp = p.spouses[0];

        // Use the spouse's OWN family color (now returned by backend)
        const spCol = sp.family_color || col;
        const isDiffFamily = sp.family_color && sp.family_color !== col;

        // Marriage connector (double line for clarity)
        grp.append('line')
          .attr('x1', NODE_W).attr('y1', NODE_H / 2 - 2)
          .attr('x2', NODE_W + SP_GAP).attr('y2', NODE_H / 2 - 2)
          .attr('stroke', isDiffFamily ? spCol : col)
          .attr('stroke-width', 2);
        grp.append('line')
          .attr('x1', NODE_W).attr('y1', NODE_H / 2 + 2)
          .attr('x2', NODE_W + SP_GAP).attr('y2', NODE_H / 2 + 2)
          .attr('stroke', isDiffFamily ? spCol : col)
          .attr('stroke-width', 2);

        const spGen = sp.generation
          ? `Gen ${sp.generation} · ${sp.is_alive ? '🟢' : '⚫'}`
          : `Gen ${p.generation}`;
        const cardG = drawCard(grp, NODE_W + SP_GAP, sp, spCol, spGen);

        // If from a different family, add a clickable small italic family label below the card
        if (isDiffFamily && sp.family_name && sp.family_id) {
          const viewLabel = cardG.append('text')
            .attr('x', NODE_W / 2)
            .attr('y', NODE_H + 15)
            .attr('text-anchor', 'middle')
            .attr('fill', spCol)
            .attr('font-family', 'Inter, sans-serif')
            .attr('font-size', '10px')
            .attr('font-weight', '500')
            .style('cursor', 'pointer')
            .text(`View ${sp.family_name} Tree ➔`)
            .on('click', (event: MouseEvent) => {
              event.stopPropagation();
              self.selectedFamilyId = sp.family_id;
              self.loadTree();
            });

          viewLabel.on('mouseenter', () => { viewLabel.attr('text-decoration', 'underline'); });
          viewLabel.on('mouseleave', () => { viewLabel.attr('text-decoration', 'none'); });
        }
      }
    });

    // Center view
    svg.call((this.zoomBehavior as any).transform,
      d3.zoomIdentity.translate(width / 2 - xOffset / 2, 60).scale(0.85));
    this.svg = svg;
  }

  zoomIn()    { this.svg?.transition().duration(300).call((this.zoomBehavior as any).scaleBy, 1.3); }
  zoomOut()   { this.svg?.transition().duration(300).call((this.zoomBehavior as any).scaleBy, 0.75); }
  resetZoom() { this.svg?.transition().duration(400).call((this.zoomBehavior as any).transform, d3.zoomIdentity.translate(600, 60).scale(0.85)); }

  fixGenerations() {
    this.fixing = true;
    this.api.recalculateGenerations().subscribe({
      next: (res) => {
        alert(res.message + ' — reloading tree.');
        this.fixing = false;
        this.loadTree();
      },
      error: () => { alert('Failed to recalculate.'); this.fixing = false; }
    });
  }
}
