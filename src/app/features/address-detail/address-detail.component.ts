import { Component, inject, signal } from '@angular/core';
import { AsyncPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, map, of, switchMap, tap, firstValueFrom } from 'rxjs';
import { MempoolService } from '../../core/servicios/mempool.service';
import { AddressInfo, Tx } from '../../core/modelos/mempool.models';

@Component({
  selector: 'app-address-detail',
  standalone: true,
  imports: [AsyncPipe, DatePipe, DecimalPipe, RouterLink],
  templateUrl: './address-detail.component.html',
  styleUrls: ['./address-detail.component.scss'],
})
export class AddressDetailComponent {
  private api = inject(MempoolService);
  private route = inject(ActivatedRoute);

  address = '';
  error = signal(false);
  txs = signal<Tx[]>([]);
  loadingMore = signal(false);
  done = signal(false);

  private addr$ = this.route.paramMap.pipe(map((p) => p.get('addr')!));

  info$ = this.addr$.pipe(
    tap(() => this.error.set(false)),
    switchMap((a) =>
      this.api.getAddress(a).pipe(
        catchError(() => {
          this.error.set(true);
          return EMPTY;
        }),
      ),
    ),
  );

  constructor() {
    this.addr$
      .pipe(
        tap((a) => {
          this.address = a;
          this.txs.set([]);
          this.done.set(false);
        }),
        switchMap((a) => this.api.getAddressTxs(a).pipe(catchError(() => of([] as Tx[])))),
        takeUntilDestroyed(),
      )
      .subscribe((list) => {
        this.txs.set(list);
        if (list.length === 0) this.done.set(true);
      });
  }

  balance(i: AddressInfo): number {
    return i.chain_stats.funded_txo_sum - i.chain_stats.spent_txo_sum;
  }

 
  net(tx: Tx): number {
    const spent = tx.vin.reduce(
      (s, v) => (v.prevout?.scriptpubkey_address === this.address ? s + (v.prevout?.value ?? 0) : s),
      0,
    );
    const received = tx.vout.reduce(
      (s, o) => (o.scriptpubkey_address === this.address ? s + o.value : s),
      0,
    );
    return received - spent;
  }

  async loadMore() {
    const confirmed = this.txs().filter((t) => t.status.confirmed);
    const last = confirmed[confirmed.length - 1];
    if (!last || this.loadingMore()) return;

    this.loadingMore.set(true);
    try {
      const more = await firstValueFrom(this.api.getAddressTxs(this.address, last.txid));
      this.txs.update((list) => [...list, ...more]);
      if (more.length < 25) this.done.set(true);
    } catch {
      this.done.set(true);
    } finally {
      this.loadingMore.set(false);
    }
  }
}