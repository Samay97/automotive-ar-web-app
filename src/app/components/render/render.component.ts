import { AfterViewInit, Component, ElementRef, NgZone, ViewChild } from '@angular/core';
import { App } from 'src/app/core';

@Component({
  selector: 'app-render',
  templateUrl: './render.component.html',
  styleUrls: ['./render.component.sass'],
})
export class RenderComponent implements AfterViewInit {
  public error: Error | null = null;
  public app!: App;
  public fps: string = '0';

  @ViewChild('canvas', { static: true }) private canvas?: ElementRef<HTMLCanvasElement>;

  constructor(private ngZone: NgZone) {}

  public async ngAfterViewInit(): Promise<void> {
    if (this.canvas) {
      try {
        this.app = new App(this.canvas.nativeElement, this.ngZone);
        this.app.startRender();
        setInterval(() => {
          this.fps = this.app.fps;
        }, 10);
      } catch (e: any) {
        console.error(e);
        this.error = e;
      }
    }
  }

  public enterXR(): void {
    this.app.enterXRMode();
  }
}
