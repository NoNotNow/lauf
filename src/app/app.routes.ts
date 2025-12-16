import { Routes } from '@angular/router';
import { GameComponent } from './features/game/game.component';
import { BuilderComponent } from './features/builder/builder.component';

export const routes: Routes = [
  { path: '', redirectTo: 'game', pathMatch: 'full' },
  { path: 'game', component: GameComponent },
  { path: 'builder', component: BuilderComponent },
  { path: '**', redirectTo: 'game' }
];
