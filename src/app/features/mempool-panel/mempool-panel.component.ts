import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, filter, forkJoin, of, switchMap, tap, timer } from 'rxjs';
import { MempoolService } from '../../core/servicios/mempool.service';
import { Fees, MempoolInfo, RbfNode, RbfTx, RecentTx } from '../../core/modelos/mempool.models';

const REFRESH_MS = 15000; // cada 15 s, para no pasarse del límite de la API
const MAX_SAMPLES = 120; // 30 minutos de historia

interface Sample { t: number; vsize: number; count: number }
interface RbfRow { txid: string; oldRate: number | null; newRate: number | null; mined: boolean; fullRbf: boolean }
interface RecentRow { txid: string; value: number; rate: number }

@Component({
  selector: 'app-mempool-panel',
  standalone: true,
  imports: [DecimalPipe, DatePipe, RouterLink],
  templateUrl: './mempool-panel.component.html',
  styleUrls: ['./mempool-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MempoolPanelComponent {
  private api = inject(MempoolService);

  fees = signal<Fees | null>(null);
  mempool = signal<MempoolInfo | null>(null);
  recent = signal<RecentTx[]>([]);
  replacements = signal<RbfNode[]>([]);
  history = signal<Sample[]>([]);
  loading = signal(true);
  error = signal(false);

  // En testnet las monedas se llaman tBTC, en signet sBTC
  unit = computed(() => {
    const u = this.api.baseUrl();
    return u.includes('testnet') ? 'tBTC' : u.includes('signet') ? 'sBTC' : 'BTC';
  });

  recentRows = computed<RecentRow[]>(() =>
    this.recent()
      .slice(0, 8)
      .map((t) => ({ txid: t.txid, value: t.value, rate: t.vsize ? t.fee / t.vsize : 0 })),
  );

  rbfRows = computed<RbfRow[]>(() =>
    this.replacements()
      .slice(0, 6)
      .flatMap((node) => {
        // Si la respuesta no trae "tx", se intenta tratar el elemento como la transacción
        const tx: RbfTx | undefined = node.tx ?? (node as unknown as RbfTx);
        if (!tx?.txid) return [];
        const prev = node.replaces?.[0]?.tx;
        return [
          {
            txid: tx.txid,
            oldRate: this.rateOf(prev),
            newRate: this.rateOf(tx),
            mined: !!(node.mined || tx.mined),
            fullRbf: !!(node.fullRbf || tx.fullRbf),
          },
        ];
      }),
  );

  // Gráfico en SVG armado con las muestras que vamos guardando
  // chart = computed(() => {
  //   const pts = this.history();
  //   if (pts.length < 2) return null;

  //   const W = 600, H = 180, padX = 8, padY = 12;
  //   const max = Math.max(...pts.map((p) => p.vsize), 1);
  //   const x = (i: number) => padX + (i / (pts.length - 1)) * (W - 2 * padX);
  //   const y = (v: number) => H - padY - (v / max) * (H - 2 * padY);

  //   const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.vsize).toFixed(1)}`).join(' ');
  //   const area = `${x(0).toFixed(1)},${H - padY} ${line} ${x(pts.length - 1).toFixed(1)},${H - padY}`;
  //   const grid = [0, 1, 2, 3].map((i) => padY + (i * (H - 2 * padY)) / 3);

  //   return { W, H, line, area, grid, max, from: pts[0].t, to: pts[pts.length - 1].t };
  // });

  chart = computed(() => {
  const pts = this.history();
  if (pts.length < 2) return null;

  const W = 600, H = 180, padX = 8, padY = 12;
  const values = pts.map((p) => p.vsize);
  const maxV = Math.max(...values);
  const minV = Math.min(...values);

  // La escala se ajusta al rango de los datos, con un 10 % de margen.
  // Si no hubo cambios, se usa un rango artificial y la línea queda en el medio.
  const span = maxV - minV || Math.max(maxV * 0.02, 1);
  const lo = minV - span * 0.1;
  const hi = maxV + span * 0.1;

  const x = (i: number) => padX + (i / (pts.length - 1)) * (W - 2 * padX);
  const y = (v: number) => H - padY - ((v - lo) / (hi - lo)) * (H - 2 * padY);

  const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.vsize).toFixed(1)}`).join(' ');
  const area = `${x(0).toFixed(1)},${H - padY} ${line} ${x(pts.length - 1).toFixed(1)},${H - padY}`;
  const grid = [0, 1, 2, 3].map((i) => padY + (i * (H - 2 * padY)) / 3);

  return { W, H, line, area, grid, max: maxV, min: minV, from: pts[0].t, to: pts[pts.length - 1].t };
});

  constructor() {
    // Se reinicia al cambiar de red/nodo y refresca cada 15 s (pausa si la pestaña está oculta)
    toObservable(this.api.baseUrl)
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(false);
          this.fees.set(null);
          this.mempool.set(null);
          this.recent.set([]);
          this.replacements.set([]);
          this.history.set([]);
        }),
        switchMap(() =>
          timer(0, REFRESH_MS).pipe(
            filter(() => !document.hidden),
            switchMap(() =>
              forkJoin({
                fees: this.api.getPreciseFees().pipe(catchError(() => of(null))),
                mempool: this.api.getMempool().pipe(catchError(() => of(null))),
                recent: this.api.getMempoolRecent().pipe(catchError(() => of([] as RecentTx[]))),
                replacements: this.api.getReplacements().pipe(catchError(() => of([] as RbfNode[]))),
              }),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ fees, mempool, recent, replacements }) => {
        this.loading.set(false);
        if (fees) this.fees.set(fees);
        if (mempool) {
          this.mempool.set(mempool);
          this.history.update((h) =>
            [...h, { t: Date.now(), vsize: mempool.vsize, count: mempool.count }].slice(-MAX_SAMPLES),
          );
        }
        this.recent.set(recent);
        this.replacements.set(replacements);
        this.error.set(!this.fees() && !this.mempool());
      });
  }

  // private rateOf(t?: RbfTx): number | null {
  //   if (!t) return null;
  //   if (typeof t.rate === 'number') return t.rate;
  //   if (t.fee != null && t.vsize) return t.fee / t.vsize;
  //   return null;
  // }

  private rateOf(t?: RbfTx): number | null {
  if (!t) return null;
  if (t.fee != null && t.vsize) return t.fee / t.vsize;
  return typeof t.rate === 'number' ? t.rate : null;
}

  short(txid: string): string {
    return `${txid.slice(0, 8)}…${txid.slice(-5)}`;
  }

  vsizeLabel(v: number): string {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} MvB`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)} kvB`;
    return `${v} vB`;
  }
}