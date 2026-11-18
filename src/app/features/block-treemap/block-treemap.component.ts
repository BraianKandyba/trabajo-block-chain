import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';
import { MempoolService } from '../../core/servicios/mempool.service';
import { TxSummary } from '../../core/modelos/mempool.models';

interface Rect {
  tx: TxSummary;
  coinbase: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

const FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'high', label: 'Comisión alta (≥ 10 sat/vB)' },
  { id: 'low', label: 'Comisión baja (< 2 sat/vB)' },
  { id: 'big', label: 'Grandes (≥ 5 kvB)' },
] as const;

type FilterId = (typeof FILTERS)[number]['id'];

const MAX_RATE = 100; // a partir de acá el color ya no cambia

@Component({
  selector: 'app-block-treemap',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './block-treemap.component.html',
  styleUrls: ['./block-treemap.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockTreemapComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) hash!: string;

  private api = inject(MempoolService);
  private router = inject(Router);
  private sub?: Subscription;

  readonly W = 1000;
  readonly H = 560;
  readonly filters = FILTERS;

  txs = signal<TxSummary[]>([]);
  loading = signal(true);
  error = signal(false);
  filter = signal<FilterId>('all');
  hovered = signal<Rect | null>(null);
  tip = signal({ x: 0, y: 0, flip: false });

  // Calcula la posición y el tamaño de cada rectángulo
  rects = computed<Rect[]>(() => {
    const list = this.txs();
    if (list.length === 0) return [];

    const coinbaseId = list[0].txid; // la primera tx del bloque es la coinbase

    const root = hierarchy<any>({ children: list })
      .sum((d) => d.vsize ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const layout = treemap<any>()
      .size([this.W, this.H])
      .tile(treemapSquarify)
      .paddingInner(0.6);

    return layout(root)
      .leaves()
      .map((n) => {
        const tx = n.data as TxSummary;
        const coinbase = tx.txid === coinbaseId;
        return {
          tx,
          coinbase,
          x: n.x0,
          y: n.y0,
          w: Math.max(n.x1 - n.x0, 0),
          h: Math.max(n.y1 - n.y0, 0),
          color: this.color(tx, coinbase),
        };
      });
  });

  ngOnChanges(changes: SimpleChanges) {
    if (!changes['hash']) return;

    this.sub?.unsubscribe();
    this.loading.set(true);
    this.error.set(false);
    this.txs.set([]);
    this.hovered.set(null);

    this.sub = this.api.getBlockSummary(this.hash).subscribe({
      next: (list) => {
        this.txs.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  // Verde (comisión baja) -> amarillo -> naranja (comisión alta)
  private color(tx: TxSummary, coinbase: boolean): string {
    if (coinbase) return '#3b6ea5';
    const t = Math.min(Math.log2(Math.max(tx.rate, 0) + 1) / Math.log2(MAX_RATE + 1), 1);
    const hue = 140 - t * 110;
    return `hsl(${hue}, 65%, 38%)`;
  }

  // Qué rectángulos se ven con fuerza según el filtro elegido
  matches(r: Rect): boolean {
    switch (this.filter()) {
      case 'high': return !r.coinbase && r.tx.rate >= 10;
      case 'low': return !r.coinbase && r.tx.rate < 2;
      case 'big': return r.tx.vsize >= 5000;
      default: return true;
    }
  }

  // Un solo handler para todo el SVG: lee el índice guardado en data-i
  private rectAt(ev: MouseEvent): Rect | null {
    const i = (ev.target as Element).getAttribute?.('data-i');
    return i == null ? null : (this.rects()[+i] ?? null);
  }

  onMove(ev: MouseEvent) {
    const r = this.rectAt(ev);
    this.hovered.set(r);
    if (!r) return;
    const box = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ev.clientX - box.left;
    this.tip.set({ x, y: ev.clientY - box.top, flip: x > box.width - 260 });
  }

  onClick(ev: MouseEvent) {
    const r = this.rectAt(ev);
    if (r) this.router.navigate(['/tx', r.tx.txid]);
  }

  short(txid: string): string {
    return `${txid.slice(0, 8)}…${txid.slice(-8)}`;
  }
}