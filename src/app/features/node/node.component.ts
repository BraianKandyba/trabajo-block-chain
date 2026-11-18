import { Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DEFAULT_API_URL, MempoolService } from '../../core/servicios/mempool.service';

type Status = 'idle' | 'testing' | 'ok' | 'error';

@Component({
  selector: 'app-node',
  standalone: true,
  templateUrl: './node.component.html',
  styleUrls: ['./node.component.scss'],
})
export class NodeComponent {
  api = inject(MempoolService);
  defaultUrl = DEFAULT_API_URL;

  status = signal<Status>('idle');
  height = signal<number | null>(null);

  isCustom() {
    return this.api.baseUrl() !== DEFAULT_API_URL;
  }

  async connect(url: string) {
    const clean = url.trim();
    if (!clean) {
      this.status.set('error');
      return;
    }
    this.status.set('testing');
    try {
      const h = await firstValueFrom(this.api.testConnection(clean));
      if (Number.isNaN(h)) throw new Error('Respuesta inválida');
      this.height.set(h);
      this.api.setBaseUrl(clean);
      this.status.set('ok');
    } catch {
      this.height.set(null);
      this.status.set('error');
    }
  }

  usePublic() {
    this.api.resetBaseUrl();
    this.connect(DEFAULT_API_URL);
  }
}