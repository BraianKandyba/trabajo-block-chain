import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MempoolService } from '../../core/servicios/mempool.service';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  templateUrl: './search-bar.component.html',
  styleUrls: ['./search-bar.component.scss'],
})
export class SearchBarComponent {
  private router = inject(Router);
  private api = inject(MempoolService);
  error = '';

  async search(value: string) {
    // Si pegaron un link, nos quedamos con lo último: .../block/HASH -> HASH
    const q = value.trim().split(/[?#]/)[0].split('/').filter(Boolean).pop() ?? '';
    this.error = '';
    if (!q) return;

    // 1) Altura de bloque
    if (/^\d+$/.test(q)) {
      try {
        const hash = await firstValueFrom(this.api.getBlockHash(+q));
        this.router.navigate(['/block', hash]);
      } catch {
        this.error = 'No existe un bloque con esa altura.';
      }
      return;
    }

    // 2) Hash de 64 caracteres: probar como tx y, si no existe, como bloque
    if (/^[0-9a-fA-F]{64}$/.test(q)) {
      try {
        await firstValueFrom(this.api.getTx(q));
        this.router.navigate(['/tx', q]);
      } catch {
        try {
          await firstValueFrom(this.api.getBlock(q));
          this.router.navigate(['/block', q]);
        } catch {
          this.error = 'No se encontró ninguna transacción ni bloque con ese hash.';
        }
      }
      return;
    }

    // 3) Dirección (bc1/tb1 o formato clásico)
    if (/^(bc1|tb1|[13mn2])[a-zA-HJ-NP-Z0-9]{25,90}$/.test(q)) {
      this.router.navigate(['/address', q]);
      return;
    }

    this.error = 'Ingresá una altura, un hash/txid o una dirección.';
  }
}