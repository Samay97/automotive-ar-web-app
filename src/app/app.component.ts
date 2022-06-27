import { AfterViewInit, Component, ElementRef, NgZone, ViewChild } from '@angular/core';
import { App } from './core/app';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass'],
})
export class AppComponent implements AfterViewInit {
  public error: Error | null = null;

  @ViewChild('canvas', { static: true }) private canvas?: ElementRef<HTMLCanvasElement>;

  constructor(private readonly ngZone: NgZone) {}

  public async ngAfterViewInit(): Promise<void> {
    if (this.canvas) {
      try {
        const app = new App(this.canvas.nativeElement, this.ngZone);
      } catch (e: any) {
        console.error(e);
        this.error = e;
      }
    }
  }
}
