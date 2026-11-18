// import { Component } from '@angular/core';
// import { RouterOutlet, RouterLink } from '@angular/router';
// import { SearchBarComponent } from './shared/search-bar/search-bar.component';

// @Component({
//   selector: 'app-root',
//   imports: [RouterOutlet, RouterLink, SearchBarComponent],
//   templateUrl: './app.component.html',
//   styleUrl: './app.component.scss',
// })
// export class AppComponent {}

import { Component, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap, timer } from 'rxjs';
import { SearchBarComponent } from './shared/search-bar/search-bar.component';
import { MempoolService } from './core/servicios/mempool.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, SearchBarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private api = inject(MempoolService);

  // Se reinicia cada vez que cambia la URL base y consulta cada 30 s
  tip = toSignal(
    toObservable(this.api.baseUrl).pipe(
      switchMap(() =>
        timer(0, 30000).pipe(
          switchMap(() =>
            this.api.getTipHeight().pipe(
              map((height) => ({ ok: true, height })),
              catchError(() => of({ ok: false, height: null })),
            ),
          ),
        ),
      ),
    ),
  );
}