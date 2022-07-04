import { Scene } from '@babylonjs/core';
import { AdvancedDynamicTexture, Control, TextBlock } from '@babylonjs/gui';

export class GUI {
  private ui: AdvancedDynamicTexture;

  constructor(scene: Scene, isVisible = false) {
    this.ui = AdvancedDynamicTexture.CreateFullscreenUI('UI', true, scene);
    this.ui.parseFromURLAsync('assets/gui/guiTexture.json').then(() => this.toggle(isVisible));
  }

  public updateText(controlName: string, newText: string): void {
    const control = this.ui.getControlByName(controlName);
    if (!control) return;
    if (!(control instanceof TextBlock)) return;
    control.text = newText;
  }

  public toggle(visibility: boolean): void {
    this.ui.executeOnAllControls((control: Control) => {
      control.isVisible = visibility;
    });
  }
}
