export interface RejectInfo {
  known: boolean;
  title: string;
  explain: string;
  fix: string;
  technical: string; 
  code: number | null;
}

interface Rule {
  patterns: string[]; 
  title: string;
  explain: string;
  fix: string;
  extra?: (raw: string) => string; 
}


const feeNumbers = (raw: string): string => {
  const m = /(\d+)\s*<\s*(\d+)/.exec(raw);
  return m ? ` Tu transacción paga ${m[1]} sats y la red exige al menos ${m[2]} sats.` : '';
};


const RULES: Rule[] = [
  {
    patterns: ['bad-txns-inputs-missingorspent', 'missing inputs'],
    title: 'Las monedas que querés gastar no existen o ya se gastaron',
    explain:
      'La transacción usa una salida (UTXO) que esta red no conoce: o nunca existió, o ya la gastó otra transacción, o es de otra red (por ejemplo testnet3 en vez de testnet4). También pasa si gastás una salida de una transacción que el nodo todavía no recibió.',
    fix: 'Abrí la transacción de origen en el explorador y mirá si esa salida figura como gastada. Confirmá que tu wallet esté en testnet4 y que no hayas generado dos veces el mismo gasto.',
  },
  {
    patterns: ['txn-mempool-conflict'],
    title: 'Otra transacción pendiente ya gasta esas mismas monedas',
    explain:
      'Hay otra transacción esperando en el mempool que usa una de tus entradas, y la tuya no cumple las reglas para reemplazarla (RBF).',
    fix: 'Esperá a que la otra se confirme o desaparezca, o creá un reemplazo con una comisión mayor y que señale RBF.',
  },
  {
    patterns: ['txn-already-in-mempool', 'txn-already-known'],
    title: 'La red ya conoce esta transacción',
    explain: 'La transacción ya está en el mempool, o sus salidas ya existen. No es un error real.',
    fix: 'No hace falta reenviarla. Seguila con el rastreador usando su txid.',
  },
  {
    patterns: ['already in block chain', 'already in utxo set'],
    title: 'Esta transacción ya está confirmada',
    explain: 'La transacción ya fue incluida en un bloque, así que no se puede enviar de nuevo.',
    fix: 'Buscala por su txid en el buscador.',
  },
  {
    patterns: ['mempool min fee not met'],
    title: 'El mempool está lleno y tu comisión quedó por debajo del piso actual',
    explain:
      'Cuando el mempool de un nodo se llena, sube la tasa mínima para entrar, y la tuya quedó por debajo.',
    fix: 'Subí la tasa de comisión (mirá la "Tarifa mínima" y las comisiones recomendadas del panel) y probá de nuevo.',
    extra: feeNumbers,
  },
  {
    patterns: ['min relay fee not met'],
    title: 'La comisión es demasiado baja',
    explain:
      'Los nodos exigen una tasa mínima para retransmitir una transacción, y la tuya paga menos que eso.',
    fix: 'Aumentá la comisión. La "Tarifa mínima" del panel de mempool te dice el piso actual de la red.',
    extra: feeNumbers,
  },
  {
    patterns: ['bad-txns-in-belowout'],
    title: 'Las salidas suman más que las entradas',
    explain:
      'La transacción intenta enviar más monedas de las que entran en ella, y no quedaría nada para pagar la comisión.',
    fix: 'Revisá los montos (en satoshis, no en BTC) y dejá margen para la comisión.',
  },
  {
    patterns: ['script-verify-flag'],
    title: 'La firma o el script no son válidos',
    explain:
      'La red rechazó la firma (o el script de desbloqueo) de alguna entrada. Puede faltar firmar, haberse firmado con otra clave, con un monto equivocado o con un tipo de script distinto.',
    fix: 'Verificá que la transacción esté completamente firmada y con la clave correcta. En SegWit, el monto de cada entrada forma parte de la firma.',
  },
  {
    patterns: ['bad-txns-nonfinal', 'non-final', 'non-bip68-final'],
    title: 'Todavía no se puede incluir: tiene un bloqueo temporal',
    explain:
      'La transacción tiene un tiempo de bloqueo (locktime o secuencia relativa) que todavía no se cumplió.',
    fix: 'Esperá a que pase la altura de bloque o la fecha indicada, o revisá el locktime con el que se armó.',
  },
  {
    patterns: ['premature-spend-of-coinbase'],
    title: 'Estás gastando una recompensa de minería que todavía no maduró',
    explain: 'Las monedas de la coinbase solo se pueden gastar después de 100 confirmaciones.',
    fix: 'Esperá a que el bloque que las generó tenga al menos 100 confirmaciones.',
  },
  {
    patterns: ['too-long-mempool-chain'],
    title: 'Hay demasiadas transacciones pendientes encadenadas',
    explain:
      'Estás gastando una salida de una transacción sin confirmar que ya tiene una cadena muy larga de dependencias, y los nodos limitan eso.',
    fix: 'Esperá a que se confirmen las transacciones anteriores antes de enviar esta.',
  },
  {
    patterns: ['insufficient fee', 'replacement-adds-unconfirmed', 'too many potential replacements'],
    title: 'No cumple las reglas para reemplazar otra transacción (RBF)',
    explain:
      'Para reemplazar una transacción pendiente hay que pagar más comisión que la original (en total y por vB) y no sumar entradas sin confirmar.',
    fix: 'Subí la comisión del reemplazo y usá solo entradas ya confirmadas.',
  },
  {
    patterns: ['truc-violation'],
    title: 'No cumple las reglas de las transacciones versión 3 (TRUC)',
    explain:
      'Las transacciones de versión 3 tienen límites estrictos de tamaño y de encadenamiento, y esta los incumple.',
    fix: 'Probá con versión 2, o ajustá el tamaño y las dependencias de la transacción.',
  },
  {
    patterns: ['tx-size-small'],
    title: 'La transacción es demasiado pequeña',
    explain: 'Los nodos no aceptan transacciones de menos de 65 bytes (sin contar los datos de testigo).',
    fix: 'Revisá que el hex esté completo: una transacción real casi nunca es tan corta.',
  },
  {
    patterns: ['tx-size'],
    title: 'La transacción es demasiado grande',
    explain:
      'Supera el tamaño máximo que los nodos retransmiten (400.000 unidades de peso, unos 100.000 vB).',
    fix: 'Dividí el pago en varias transacciones o usá menos entradas.',
  },
  {
    patterns: ['dust'],
    title: 'Una salida es demasiado pequeña (polvo)',
    explain: 'Hay una salida con un monto tan bajo que no conviene gastarla, y los nodos no la retransmiten.',
    fix: 'Aumentá el monto de esa salida o sumalo a otra.',
  },
  {
    patterns: ['scriptpubkey'],
    title: 'Una salida usa un tipo de script no estándar',
    explain: 'Los nodos solo retransmiten salidas con formatos habituales de dirección.',
    fix: 'Usá direcciones estándar (por ejemplo P2WPKH o P2TR).',
  },
  {
    patterns: ['tx decode failed', 'decode failed'],
    title: 'No se pudo leer la transacción',
    explain:
      'El hex no tiene el formato de una transacción: puede estar incompleto, cortado al copiarlo o ser otra cosa (un PSBT, un txid).',
    fix: 'Copiá el hex completo de la transacción firmada, sin espacios ni saltos de línea.',
  },
  {
    patterns: ['bad-txns-vin-empty', 'bad-txns-vout-empty'],
    title: 'La transacción no tiene entradas o no tiene salidas',
    explain: 'Una transacción válida necesita al menos una entrada y una salida.',
    fix: 'Revisá cómo se armó la transacción.',
  },
  {
    patterns: ['bad-txns-inputs-duplicate'],
    title: 'La misma entrada aparece dos veces',
    explain: 'No se puede gastar la misma salida dos veces dentro de una transacción.',
    fix: 'Quitá la entrada repetida.',
  },
  {
    patterns: [
      'bad-txns-vout-negative',
      'bad-txns-vout-toolarge',
      'bad-txns-txouttotal-toolarge',
      'bad-txns-fee-outofrange',
    ],
    title: 'Algún monto es inválido',
    explain: 'Una salida tiene un monto negativo o imposible de representar, o la suma de montos es inválida.',
    fix: 'Revisá los montos de las salidas (en satoshis).',
  },
  {
    patterns: ['fee exceeds maximum', 'max-fee-exceeded'],
    title: 'La comisión es exageradamente alta',
    explain:
      'El nodo tiene una protección contra comisiones absurdas, y esta transacción paga muchísimo más de lo razonable.',
    fix: 'Revisá los montos: es común confundir BTC con satoshis.',
  },
];

function parseRaw(raw: string): { message: string; code: number | null } {
  const msg = /"message"\s*:\s*"([^"]*)"/.exec(raw)?.[1];
  const code = /"code"\s*:\s*(-?\d+)/.exec(raw)?.[1] ?? /error\s*(-?\d+)\s*:/i.exec(raw)?.[1];
  return { message: (msg ?? raw).trim(), code: code ? Number(code) : null };
}

export function explainReject(raw: string): RejectInfo {
  const { message, code } = parseRaw(raw);
  const lower = raw.toLowerCase();
  const rule = RULES.find((r) => r.patterns.some((p) => lower.includes(p)));

  if (!rule) {
    return {
      known: false,
      title: 'La red rechazó la transacción',
      explain:
        'El mensaje de error no está en nuestra tabla. Buscá el texto técnico de abajo en la documentación de Bitcoin Core para entender el motivo.',
      fix: 'Revisá que la transacción esté firmada, que sus entradas existan en esta red y que la comisión sea suficiente.',
      technical: message || raw.trim() || 'Sin mensaje',
      code,
    };
  }

  return {
    known: true,
    title: rule.title,
    explain: rule.explain + (rule.extra ? rule.extra(raw) : ''),
    fix: rule.fix,
    technical: message,
    code,
  };
}