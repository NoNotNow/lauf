import { Component } from '@angular/core';
import {MapComponent} from "../stage/components/map/map.component";

@Component({
    selector: 'app-game',
    standalone: true,
    templateUrl: './game.component.html',
    imports: [
        MapComponent
    ],
    styleUrls: ['./game.component.scss']
})
export class GameComponent { }
