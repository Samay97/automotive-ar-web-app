import { AfterViewInit, Component } from '@angular/core';
declare var anime: any;

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.sass'],
})
export class HomeComponent implements AfterViewInit {
  constructor() {}

  ngAfterViewInit(): void {
    // Wrap every letter in a span
    const textWrapper = document.querySelector('.c1 .letters');
    const textWrapper2 = document.querySelector('.c2 .letters2');

    if (!textWrapper) return;
    if (!textWrapper2) return;

    textWrapper.innerHTML =
      textWrapper.textContent?.replace(/\S/g, "<span class='letter' style='display:inline-block;'>$&</span>") ?? '';

    textWrapper2.innerHTML =
      textWrapper2.textContent?.replace(/\S/g, "<span class='letter' style='display:inline-block;'>$&</span>") ?? '';

    anime
      .timeline({ loop: false })
      .add({
        targets: '.c1 .line',
        scaleY: [0, 1],
        opacity: [0.5, 1],
        easing: 'easeOutExpo',
        duration: 800,
      })
      .add({
        targets: '.c1 .line',
        translateX: [0, textWrapper.getBoundingClientRect().width + 10],
        easing: 'easeOutExpo',
        duration: 900,
        delay: 500,
      })
      .add({
        targets: '.c1 .letter',
        opacity: [0, 1],
        easing: 'easeOutExpo',
        duration: 900,
        offset: '-=775',
        delay: (el: any, i: number) => 34 * (i + 1),
      })
      .add({
        targets: '.c1',
        opacity: 1,
        duration: 1000,
        easing: 'easeOutExpo',
        delay: 200,
      })
      .add({
        targets: '.c1 .line',
        opacity: [1, 0],
        easing: 'easeOutExpo',
        duration: 600,
        offset: '-=1000',
      })
      .add({
        targets: '.c2 .line2',
        scaleY: [0, 1],
        opacity: [0.5, 1],
        easing: 'easeOutExpo',
        duration: 800,
      })
      .add({
        targets: '.c2 .line2',
        translateX: [0, textWrapper2.getBoundingClientRect().width + 10],
        easing: 'easeOutExpo',
        duration: 1200,
      })
      .add({
        targets: '.c2 .letter',
        opacity: [0, 1],
        easing: 'easeOutExpo',
        duration: 900,
        offset: '-=975',
        delay: (el: any, i: number) => 34 * (i + 1),
      })
      .add({
        targets: '.c2',
        opacity: 1,
        duration: 1000,
        easing: 'easeOutExpo',
        delay: 500,
      })
      .add({
        targets: '.c2 .line2',
        opacity: [1, 0],
        easing: 'easeOutExpo',
        duration: 800,
      })
      .add({
        targets: '.modern-button',
        opacity: [0, 1],
        easing: 'easeInExpo',
        duration: 600,
        offset: '-=2500',
      });
  }
}
