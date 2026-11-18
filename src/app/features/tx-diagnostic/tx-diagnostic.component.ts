import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MempoolService } from '../../core/servicios/mempool.service';
import { cleanHex, precheck } from '../../core/utils/tx-precheck';
import { RejectInfo, explainReject } from '../../core/utils/reject-reasons';

type Outcome =
  | { kind: 'accepted'; txid: string }
  | { kind: 'rejected'; status: number; info: RejectInfo }
  | { kind: 'network' }
  | { kind: 'ratelimit' };

// Transacción de ejemplo: una entrada que no existe, sin firmar. Nunca puede ser válida.
const EXAMPLE_MISSING_INPUT =
  '02000000' + // versión 2
  '01' + // 1 entrada
  'aa'.repeat(32) + // txid de la entrada (inventado)
  '00000000' + // índice de salida
  '00' + // script de firma vacío
  'fdffffff' + // secuencia
  '01' + // 1 salida
  'e803000000000000' + // 1000 sats
  '16' + '0014' + 'bb'.repeat(20) + // script P2WPKH
  '00000000'; // locktime

const EXAMPLE_TRUNCATED = EXAMPLE_MISSING_INPUT.slice(0, 40); // hex cortado

@Component({
  selector: 'app-tx-diagnostic',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './tx-diagnostic.component.html',
  styleUrls: ['./tx-diagnostic.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TxDiagnosticComponent {
  private api = inject(MempoolService);

  readonly apiUrl = this.api.baseUrl;

  hex = signal('');
  sending = signal(false);
  outcome = signal<Outcome | null>(null);

  clean = computed(() => cleanHex(this.hex()));
  check = computed(() => precheck(this.clean()));

  // Solo se permite enviar a redes de prueba
  isTestNet = computed(() => /testnet|signet/i.test(this.api.baseUrl()));
  canSend = computed(() => this.check().ok && this.isTestNet() && !this.sending());

  setHex(value: string) {
    this.hex.set(value);
    this.outcome.set(null);
  }

  loadExample(kind: 'missing' | 'truncated') {
    this.setHex(kind === 'missing' ? EXAMPLE_MISSING_INPUT : EXAMPLE_TRUNCATED);
  }

  async send() {
    if (!this.canSend()) return;

    const ok = confirm(
      'Si la transacción es válida, se va a transmitir de verdad a la red de prueba y no se puede deshacer.\n\n¿Continuar?',
    );
    if (!ok) return;

    this.sending.set(true);
    this.outcome.set(null);
    try {
      const txid = await firstValueFrom(this.api.broadcastTx(this.clean()));
      this.outcome.set({ kind: 'accepted', txid: txid.trim() });
    } catch (err) {
      this.outcome.set(this.fromError(err));
    } finally {
      this.sending.set(false);
    }
  }

  private fromError(err: unknown): Outcome {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) return { kind: 'network' };
      if (err.status === 429) return { kind: 'ratelimit' };
      const body = typeof err.error === 'string' ? err.error : JSON.stringify(err.error ?? '');
      return { kind: 'rejected', status: err.status, info: explainReject(body) };
    }
    return { kind: 'network' };
  }
}