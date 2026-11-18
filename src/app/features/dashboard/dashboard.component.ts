import { Component, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { retry, scan, startWith, switchMap, timer } from 'rxjs';
import { MempoolService } from '../../core/servicios/mempool.service';
import { Block } from '../../core/modelos/mempool.models';
import { MempoolPanelComponent } from '../mempool-panel/mempool-panel.component';

// en el decorador:


@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink, MempoolPanelComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent {
  private api = inject(MempoolService);

  // Comisiones: se reinician al cambiar de red y se refrescan cada 30 s
  fees$ = toObservable(this.api.baseUrl).pipe(
    switchMap(() =>
      timer(0, 30000).pipe(switchMap(() => this.api.getRecommendedFees())),
    ),
  );

  // Bloques: carga inicial por REST + bloques nuevos por WebSocket
  blocks$ = toObservable(this.api.baseUrl).pipe(
    switchMap(() =>
      this.api.getBlocks().pipe(
        switchMap((initial) =>
          this.api.newBlocks().pipe(
            // si el socket se cae, reintenta con espera creciente (máx. 30 s)
            retry({ delay: (_err, n) => timer(Math.min(n * 2000, 30000)) }),
            scan(
              (list: Block[], b: Block) =>
                [b, ...list.filter((x) => x.id !== b.id)].slice(0, 15),
              initial,
            ),
            startWith(initial),
          ),
        ),
      ),
    ),
  );
}