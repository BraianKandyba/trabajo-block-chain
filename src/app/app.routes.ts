import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { BlockDetailComponent } from './features/block-detail/block-detail.component';
import { TxDetailComponent } from './features/tx-detail/tx-detail.component';
import { NodeComponent } from './features/node/node.component';
import { TxTrackerComponent } from './features/tx-tracker/tx-tracker.component';
import { AddressDetailComponent } from './features/address-detail/address-detail.component';
import { TxDiagnosticComponent } from './features/tx-diagnostic/tx-diagnostic.component';


export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'block/:hash', component: BlockDetailComponent },
  { path: 'tx/:txid', component: TxDetailComponent },
  { path: 'node', component: NodeComponent },
  { path: 'address/:addr', component: AddressDetailComponent },
  { path: 'track', component: TxTrackerComponent },
  { path: 'track/:txid', component: TxTrackerComponent },
  { path: 'diagnostico', component: TxDiagnosticComponent },
  { path: '**', redirectTo: '' },
  
];