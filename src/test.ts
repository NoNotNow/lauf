// This file is required by karma.conf.js and loads recursively all the .spec and framework files

import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
);

// Import all spec files
import './app/core/models/pose.spec';
import './app/core/models/map.spec';
import './app/core/models/design/design.spec';
import './app/core/models/game-items/stage-item.spec';
import './app/core/models/game-items/physics-configuration.spec';
import './app/core/services/persistence.service.spec';
import './app/core/services/startup.service.spec';
import './app/core/services/world-assembler.service.spec';
import './app/features/stage/components/map/map.component.spec';
