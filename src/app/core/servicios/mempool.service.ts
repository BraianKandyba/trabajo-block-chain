import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, filter } from 'rxjs';
import { AddressInfo, Block, Fees, MempoolInfo, RbfNode, RecentTx, Tx, TxSummary } from '../modelos/mempool.models';
import { webSocket } from 'rxjs/webSocket';


// @Injectable({ providedIn: 'root' })
// export class MempoolService {
//   private http = inject(HttpClient);
//   private base = 'https://mempool.space/testnet4/api';

//   getRecommendedFees(): Observable<Fees> {
//     return this.http.get<Fees>(`${this.base}/v1/fees/recommended`);
//   }

//   // getBlocks(): Observable<Block[]> {
//   //   return this.http.get<Block[]>(`${this.base}/v1/blocks`);
//   // }
//   getBlocks(): Observable<Block[]> {
//   return this.http.get<Block[]>(`${this.base}/blocks`);
// }

//   getBlock(hash: string): Observable<Block> {
//     return this.http.get<Block>(`${this.base}/block/${hash}`);
//   }

//   getBlockTxs(hash: string, start = 0): Observable<Tx[]> {
//     return this.http.get<Tx[]>(`${this.base}/block/${hash}/txs/${start}`);
//   }

//   getBlockHash(height: number): Observable<string> {
//     return this.http.get(`${this.base}/block-height/${height}`, { responseType: 'text' });
//   }

//   getTx(txid: string): Observable<Tx> {
//     return this.http.get<Tx>(`${this.base}/tx/${txid}`);
//   }
// }




export const DEFAULT_API_URL = 'https://mempool.space/testnet4/api';
const STORAGE_KEY = 'mempool_api_url';

@Injectable({ providedIn: 'root' })
export class MempoolService {
  private http = inject(HttpClient);

  baseUrl = signal<string>(this.readStored());

  private readStored(): string {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_API_URL;
    } catch {
      return DEFAULT_API_URL;
    }
  }

  setBaseUrl(url: string) {
    const clean = url.trim().replace(/\/+$/, '');
    this.baseUrl.set(clean);
    try {
      localStorage.setItem(STORAGE_KEY, clean);
    } catch {}
  }

  resetBaseUrl() {
    this.baseUrl.set(DEFAULT_API_URL);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  // Prueba una URL sin guardarla
  testConnection(url: string): Observable<number> {
    const clean = url.trim().replace(/\/+$/, '');
    return this.http
      .get(`${clean}/blocks/tip/height`, { responseType: 'text' })
      .pipe(map(Number));
  }

  getTipHeight(): Observable<number> {
    return this.testConnection(this.baseUrl());
  }

  getRecommendedFees(): Observable<Fees> {
    return this.http.get<Fees>(`${this.baseUrl()}/v1/fees/recommended`);
  }

  getBlocks(): Observable<Block[]> {
    return this.http.get<Block[]>(`${this.baseUrl()}/v1/blocks`);
  }

  getBlock(hash: string): Observable<Block> {
    return this.http.get<Block>(`${this.baseUrl()}/block/${hash}`);
  }

  getBlockTxs(hash: string, start = 0): Observable<Tx[]> {
    return this.http.get<Tx[]>(`${this.baseUrl()}/block/${hash}/txs/${start}`);
  }

  getBlockHash(height: number): Observable<string> {
    return this.http.get(`${this.baseUrl()}/block-height/${height}`, {
      responseType: 'text',
    });
  }

  getTx(txid: string): Observable<Tx> {
    return this.http.get<Tx>(`${this.baseUrl()}/tx/${txid}`);
  }

  getAddress(addr: string): Observable<AddressInfo> {
  return this.http.get<AddressInfo>(`${this.baseUrl()}/address/${addr}`);
}

// Primera página: txs sin confirmar + las 25 confirmadas más recientes.
// Siguientes páginas: se pasa el último txid confirmado que ya tenés.
  getAddressTxs(addr: string, lastSeenTxid?: string): Observable<Tx[]> {
    const suffix = lastSeenTxid ? `/chain/${lastSeenTxid}` : '';
    return this.http.get<Tx[]>(`${this.baseUrl()}/address/${addr}/txs${suffix}`);
  }


  newBlocks(): Observable<Block> {
    // https://x/testnet4/api  ->  wss://x/testnet4/api/v1/ws
    const wsUrl = this.baseUrl().replace(/^http/, 'ws') + '/v1/ws';

    return new Observable<Block>((subscriber) => {
      const socket = webSocket<any>({
        url: wsUrl,
        openObserver: {
          next: () => socket.next({ action: 'want', data: ['blocks'] }),
        },
      });

      const sub = socket
        .pipe(
          filter((msg) => !!msg?.block),
          map((msg) => msg.block as Block),
        )
        .subscribe(subscriber);

      // Al desuscribirse, se cierra el socket
      return () => sub.unsubscribe();
    });
  }

  getBlockSummary(hash: string): Observable<TxSummary[]> {
    return this.http.get<TxSummary[]>(`${this.baseUrl()}/v1/block/${hash}/summary`);
  }

  getPreciseFees(): Observable<Fees> {
  return this.http.get<Fees>(`${this.baseUrl()}/v1/fees/precise`);
}

  getMempool(): Observable<MempoolInfo> {
    return this.http.get<MempoolInfo>(`${this.baseUrl()}/mempool`);
  }

  getMempoolRecent(): Observable<RecentTx[]> {
    return this.http.get<RecentTx[]>(`${this.baseUrl()}/mempool/recent`);
  }

  getReplacements(): Observable<RbfNode[]> {
    return this.http.get<RbfNode[]>(`${this.baseUrl()}/v1/replacements`);
  }

  broadcastTx(hex: string): Observable<string> {
  return this.http.post(`${this.baseUrl()}/tx`, hex, {
    responseType: 'text',
    headers: { 'Content-Type': 'text/plain' },
  });
}
}