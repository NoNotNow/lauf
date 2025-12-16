import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { provideHttpClient } from '@angular/common/http';
bootstrapApplication(AppComponent, {
    providers: [
        provideRouter(routes),
        // Provide HttpClient at the application root so services can inject it
        provideHttpClient()
    ]
}).catch(err => console.error(err));
//# sourceMappingURL=main.js.map