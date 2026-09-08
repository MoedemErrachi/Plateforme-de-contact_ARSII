import '@testing-library/jest-dom';
import { configure } from '@testing-library/dom';

// Sous charge parallèle les transitions async des composants lourds dépassent
// le timeout par défaut de waitFor (1000ms) : on relève la valeur globale.
configure({ asyncUtilTimeout: 5000 });

if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  class MockPointerEvent extends MouseEvent {
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;
    width: number;
    height: number;
    pressure: number;
    tangentialPressure: number;
    tiltX: number;
    tiltY: number;
    twist: number;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
      this.pointerType = params.pointerType ?? 'mouse';
      this.isPrimary = params.isPrimary ?? true;
      this.width = params.width ?? 1;
      this.height = params.height ?? 1;
      this.pressure = params.pressure ?? 0.5;
      this.tangentialPressure = params.tangentialPressure ?? 0;
      this.tiltX = params.tiltX ?? 0;
      this.tiltY = params.tiltY ?? 0;
      this.twist = params.twist ?? 0;
    }
    getCoalescedEvents(): PointerEvent[] {
      return [];
    }
    getPredictedEvents(): PointerEvent[] {
      return [];
    }
  }
  (window as unknown as { PointerEvent: unknown }).PointerEvent = MockPointerEvent;
}