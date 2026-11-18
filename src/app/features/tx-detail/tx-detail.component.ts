import { Component, inject } from '@angular/core';
import { AsyncPipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { MempoolService } from '../../core/servicios/mempool.service';

@Component({
  selector: 'app-tx-detail',
  imports: [AsyncPipe, DecimalPipe, RouterLink],
  templateUrl: './tx-detail.component.html',
})
export class TxDetailComponent {
  private api = inject(MempoolService);
  private route = inject(ActivatedRoute);

  tx$ = this.route.paramMap.pipe(
    map((p) => p.get('txid')!),
    switchMap((id) => this.api.getTx(id)),
  );
}