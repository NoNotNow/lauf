import { GameComponent } from './features/game/game.component';
import { BuilderComponent } from './features/builder/builder.component';
export const routes = [
    { path: '', redirectTo: 'game', pathMatch: 'full' },
    { path: 'game', component: GameComponent },
    { path: 'builder', component: BuilderComponent },
    { path: '**', redirectTo: 'game' }
];
//# sourceMappingURL=app.routes.js.map