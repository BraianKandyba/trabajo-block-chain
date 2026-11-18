export interface Precheck {
  ok: boolean; 
  level: 'idle' | 'error' | 'warn' | 'ok';
  message: string;
}

const MIN_TX_BYTES = 65; // mínimo que los nodos aceptan (sin datos de testigo)

export function cleanHex(raw: string): string {
  return raw.replace(/\s+/g, '').replace(/^0x/i, '');
}

export function precheck(s: string): Precheck {
  if (!s) return { ok: false, level: 'idle', message: '' };


  if (s.startsWith('cHNidP8') || s.toLowerCase().startsWith('70736274ff')) {
    return {
      ok: false,
      level: 'error',
      message:
        'Esto es un PSBT (una transacción que todavía no está firmada del todo), no una transacción lista para enviar. Finalizala en tu wallet y copiá el hex de la transacción firmada.',
    };
  }

  if (/^[0-9a-fA-F]{64}$/.test(s)) {
    return {
      ok: false,
      level: 'error',
      message:
        'Esto parece un txid (64 caracteres), no el hex de la transacción. Para ver una transacción ya enviada usá el buscador.',
    };
  }

  if (!/^[0-9a-fA-F]+$/.test(s)) {
    return {
      ok: false,
      level: 'error',
      message: 'Hay caracteres que no son hexadecimales (solo se permiten 0-9 y a-f).',
    };
  }

  if (s.length % 2 !== 0) {
    return {
      ok: false,
      level: 'error',
      message: 'La cantidad de caracteres es impar: falta o sobra alguno al copiar.',
    };
  }

  const bytes = s.length / 2;
  const version = parseInt(s.slice(6, 8) + s.slice(4, 6) + s.slice(2, 4) + s.slice(0, 2), 16);
  const segwit = s.slice(8, 12) === '0001'; // marcador y flag de SegWit

  if (bytes < MIN_TX_BYTES) {
    return {
      ok: true,
      level: 'warn',
      message: `Muy corta (${bytes} bytes): los nodos exigen al menos ${MIN_TX_BYTES}. Si la enviás, probablemente la rechacen.`,
    };
  }

  return {
    ok: true,
    level: 'ok',
    message: `Formato correcto: ${bytes} bytes, versión ${version}, ${segwit ? 'con datos SegWit' : 'sin datos SegWit (legacy)'}.`,
  };
}