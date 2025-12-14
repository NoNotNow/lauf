import { Routes } from '@angular/router';
import { GameComponent } from './pages/game/game.component';
import { BuilderComponent } from './pages/builder/builder.component';

export const routes: Routes = [
  { path: '', redirectTo: 'game', pathMatch: 'full' },
  { path: 'game', component: GameComponent },
  { path: 'builder', component: BuilderComponent },
  { path: '**', redirectTo: 'game' }
];
