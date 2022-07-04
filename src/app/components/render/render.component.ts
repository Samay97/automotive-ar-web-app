import { AfterViewInit, Component, ElementRef, NgZone, ViewChild } from '@angular/core';
import { App } from 'src/app/core';

declare var anime: any;
declare var playPause: any;

@Component({
  selector: 'app-render',
  templateUrl: './render.component.html',
  styleUrls: ['./render.component.sass'],
})
export class RenderComponent implements AfterViewInit {
  public error: Error | null = null;
  public app!: App;
  public fps: string = '0';
  public carLoaded = false;
  public loading = false;

  @ViewChild('canvas', { static: true }) private canvas?: ElementRef<HTMLCanvasElement>;

  constructor(private ngZone: NgZone) {}

  public async ngAfterViewInit(): Promise<void> {
    if (this.canvas) {
      try {
        this.app = new App(this.canvas.nativeElement, this.ngZone);
      } catch (e: any) {
        console.error(e);
        this.error = e;
      }
    }
  }

  public enterXR(): void {
    this.app.enterXRMode();
  }

  public loadCar(url: string) {
    this.loading = true;
    setTimeout(() => {
      anime({
        targets: 'div.box',
        translateY: [
          { value: 300, duration: 750 },
          { value: 0, duration: 1200 },
        ],
        rotate: {
          value: '1turn',
        },
        borderRadius: 50,
        direction: 'alternate',
        easing: 'easeInOutQuad',
        delay: function () {
          return anime.random(0, 400);
        },
        // autoplay: false,
        loop: true,
        elasticity: 300,
      });
    }, 10);
    this.app!.loadCar(url).then(() => {
      this.startRender();
      this.carLoaded = true;
      this.loading = false;
    });
  }

  private startRender(): void {
    this.app.startRender();
    setInterval(() => {
      this.fps = this.app.fps;
    }, 10);
  }
}
