import { Routes } from '@angular/router';
import { GameComponent } from './game/game.component';
import { BuilderComponent } from './builder/builder.component';

export const routes: Routes = [
  { path: '', redirectTo: 'game', pathMatch: 'full' },
  { path: 'game', component: GameComponent },
  { path: 'builder', component: BuilderComponent },
  { path: '**', redirectTo: 'game' }
];
