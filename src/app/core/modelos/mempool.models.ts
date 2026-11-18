export interface Fees {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

export interface Block {
  id: string;
  height: number;
  timestamp: number;
  tx_count: number;
  size: number;
  weight: number;
  extras?: { pool?: { name: string }; totalFees?: number; medianFee?: number };
}

export interface Vout {
  scriptpubkey_address?: string;
  value: number;
}

export interface Vin {
  txid: string;
  vout: number;
  is_coinbase: boolean;
  prevout: Vout | null;
}

export interface Tx {
  txid: string;
  fee: number;
  size: number;
  weight: number;
  vin: Vin[];
  vout: Vout[];
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}


export interface AddressStats {
  funded_txo_count: number;
  funded_txo_sum: number;
  spent_txo_count: number;
  spent_txo_sum: number;
  tx_count: number;
}

export interface AddressInfo {
  address: string;
  chain_stats: AddressStats;
  mempool_stats: AddressStats;
}

export interface TxSummary {
  txid: string;
  fee: number;
  vsize: number;
  value: number;
  rate: number;
  flags: number;
}



//

export interface MempoolInfo {
  count: number;
  vsize: number;
  total_fee: number;
  fee_histogram?: [number, number][];
}

export interface RecentTx {
  txid: string;
  fee: number;
  vsize: number;
  value: number;
}


export interface RbfTx {
  txid: string;
  fee?: number;
  vsize?: number;
  value?: number;
  rate?: number;
  time?: number;
  rbf?: boolean;
  mined?: boolean;
  fullRbf?: boolean;
}

export interface RbfNode {
  tx?: RbfTx;
  mined?: boolean;
  fullRbf?: boolean;
  time?: number;
  interval?: number;
  replaces?: RbfNode[];
}


