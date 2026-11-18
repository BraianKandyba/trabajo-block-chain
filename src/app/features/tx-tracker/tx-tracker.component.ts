import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  catchError,
  exhaustMap,
  forkJoin,
  map,
  of,
  switchMap,
  takeWhile,
  tap,
  timer,
} from 'rxjs';
import { MempoolService } from '../../core/servicios/mempool.service';
import { Fees, MempoolInfo, Tx } from '../../core/modelos/mempool.models';

const REFRESH_MS = 15000; // revisa cada 15 s
const MAX_MISSES = 20; // si no la encuentra en ~5 min, deja de buscar
const BLOCK_VSIZE = 1_000_000; // capacidad aproximada de un bloque, en vB

type Phase = 'idle' | 'searching' | 'notfound' | 'mempool' | 'confirmed' | 'lost' | 'gaveup';

type Result =
  | { kind: 'missing' }
  | { kind: 'error' }
  | { kind: 'pending'; tx: Tx; fees: Fees | null; mempool: MempoolInfo | null }
  | { kind: 'confirmed'; tx: Tx; tip: number | null };

@Component({
  selector: 'app-tx-tracker',
  standalone: true,
  imports: [DecimalPipe, DatePipe, RouterLink],
  templateUrl: './tx-tracker.component.html',
  styleUrls: ['./tx-tracker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TxTrackerComponent {
  private api = inject(MempoolService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private misses = 0;
  private seenInMempool = false;

  txid = signal('');
  phase = signal<Phase>('idle');
  tx = signal<Tx | null>(null);
  fees = signal<Fees | null>(null);
  mempool = signal<MempoolInfo | null>(null);
  tip = signal<number | null>(null);
  lastCheck = signal<number | null>(null);
  netError = signal(false);
  formError = signal('');

  canNotify = typeof Notification !== 'undefined';
  notifyOn = signal(typeof Notification !== 'undefined' && Notification.permission === 'granted');

  // Posición en el stepper: 1 transmitida, 2 en el mempool, 3 confirmada
  step = computed(() => (this.phase() === 'confirmed' ? 3 : this.phase() === 'mempool' ? 2 : 1));

  vsize = computed(() => {
    const t = this.tx();
    return t ? t.weight / 4 : 0;
  });

  rate = computed(() => {
    const t = this.tx();
    const v = this.vsize();
    return t && v ? t.fee / v : 0;
  });

  // Compara la tasa de la transacción con las comisiones recomendadas
  priority = computed(() => {
    const f = this.fees();
    const r = this.rate();
    if (!f || !r) return null;
    if (r >= f.fastestFee) return { label: 'Alta', cls: 'high' };
    if (r >= f.halfHourFee) return { label: 'Media', cls: 'mid' };
    if (r >= f.hourFee) return { label: 'Baja', cls: 'low' };
    if (r >= f.minimumFee) return { label: 'Muy baja', cls: 'vlow' };
    return { label: 'Por debajo del mínimo', cls: 'vlow' };
  });

  // Estimación: cuánto espacio ocupan las transacciones que pagan más que la nuestra
  ahead = computed(() => {
    const hist = this.mempool()?.fee_histogram;
    const r = this.rate();
    if (!Array.isArray(hist) || hist.length === 0 || !r) return null;

    const vsizeAhead = hist.reduce(
      (sum, entry) => (Array.isArray(entry) && entry[0] >= r ? sum + entry[1] : sum),
      0,
    );
    return { vsizeAhead, blocks: Math.floor(vsizeAhead / BLOCK_VSIZE) + 1 };
  });

  confirmations = computed(() => {
    const h = this.tx()?.status.block_height;
    const tip = this.tip();
    return h != null && tip != null ? tip - h + 1 : null;
  });

  constructor() {
    this.route.paramMap
      .pipe(
        map((p) => p.get('txid') ?? ''),
        tap((id) => this.reset(id)),
        switchMap((id) => (id ? this.poll(id) : EMPTY)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  private reset(id: string) {
    this.misses = 0;
    this.seenInMempool = false;
    this.txid.set(id);
    this.tx.set(null);
    this.fees.set(null);
    this.mempool.set(null);
    this.tip.set(null);
    this.netError.set(false);
    this.phase.set(id ? 'searching' : 'idle');
  }

  private poll(id: string): Observable<Result> {
    return timer(0, REFRESH_MS).pipe(
      exhaustMap(() => this.check(id)), // no solapa consultas si una tarda
      tap((r) => this.apply(r)),
      takeWhile(() => !this.finished(), true), // incluye la última emisión y corta
    );
  }

  private finished(): boolean {
    const p = this.phase();
    return p === 'confirmed' || p === 'lost' || p === 'gaveup';
  }

  private check(id: string): Observable<Result> {
    return this.api.getTx(id).pipe(
      switchMap((tx): Observable<Result> => {
        if (tx.status.confirmed) {
          return this.api.getTipHeight().pipe(
            map((tip): Result => ({ kind: 'confirmed', tx, tip })),
            catchError(() => of<Result>({ kind: 'confirmed', tx, tip: null })),
          );
        }
        return forkJoin({
          fees: this.api.getPreciseFees().pipe(catchError(() => of(null))),
          mempool: this.api.getMempool().pipe(catchError(() => of(null))),
        }).pipe(map(({ fees, mempool }): Result => ({ kind: 'pending', tx, fees, mempool })));
      }),
      catchError((err: unknown) =>
        // 404 = la API no la conoce; cualquier otro error = problema de conexión
        of<Result>(err instanceof HttpErrorResponse && err.status === 404 ? { kind: 'missing' } : { kind: 'error' }),
      ),
    );
  }

  private apply(r: Result) {
    this.lastCheck.set(Date.now());

    if (r.kind === 'error') {
      this.netError.set(true);
      return;
    }
    this.netError.set(false);

    if (r.kind === 'missing') {
      this.misses++;
      if (this.seenInMempool) this.phase.set('lost');
      else this.phase.set(this.misses >= MAX_MISSES ? 'gaveup' : 'notfound');
      return;
    }

    this.misses = 0;
    this.tx.set(r.tx);

    if (r.kind === 'pending') {
      this.seenInMempool = true;
      this.fees.set(r.fees);
      this.mempool.set(r.mempool);
      this.phase.set('mempool');
    } else {
      this.tip.set(r.tip);
      this.phase.set('confirmed');
      this.notify(r.tx);
    }
  }

  // Acepta un txid o el link completo de una transacción
  go(value: string) {
    const q = value.trim().split(/[?#]/)[0].split('/').filter(Boolean).pop() ?? '';
    if (!/^[0-9a-fA-F]{64}$/.test(q)) {
      this.formError.set('Ingresá un txid válido (64 caracteres hexadecimales).');
      return;
    }
    this.formError.set('');
    this.router.navigate(['/track', q.toLowerCase()]);
  }

  async enableNotifications() {
    if (!this.canNotify) return;
    const permission = await Notification.requestPermission();
    this.notifyOn.set(permission === 'granted');
  }

  private notify(tx: Tx) {
    if (!this.canNotify || !this.notifyOn() || Notification.permission !== 'granted') return;
    new Notification('Transacción confirmada', {
      body: `Entró en el bloque #${tx.status.block_height}`,
    });
  }

  short(txid: string): string {
    return `${txid.slice(0, 10)}…${txid.slice(-10)}`;
  }

  vsizeLabel(v: number): string {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} MvB`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)} kvB`;
    return `${Math.round(v)} vB`;
  }
}