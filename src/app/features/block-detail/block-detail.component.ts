import { Component, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { MempoolService } from '../../core/servicios/mempool.service';
import { BlockTreemapComponent } from '../block-treemap/block-treemap.component';



@Component({
  selector: 'app-block-detail',
  imports: [AsyncPipe, DatePipe, RouterLink, BlockTreemapComponent],
  templateUrl: './block-detail.component.html',
})
export class BlockDetailComponent {
  private api = inject(MempoolService);
  private route = inject(ActivatedRoute);

  private hash$ = this.route.paramMap.pipe(map((p) => p.get('hash')!));
  block$ = this.hash$.pipe(switchMap((h) => this.api.getBlock(h)));
  txs$ = this.hash$.pipe(switchMap((h) => this.api.getBlockTxs(h)));
}