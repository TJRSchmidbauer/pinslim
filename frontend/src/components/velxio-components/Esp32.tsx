import { useEffect, useRef } from 'react';
import './Esp32Element';
import type { BoardKind } from '../../types/board';

interface Esp32Props {
  id?: string;
  x?: number;
  y?: number;
  boardKind?: BoardKind;
  /** User LED on the board lit (already resolved for active-low LEDs). */
  led?: boolean;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'velxio-esp32': any;
    }
  }
}

export const Esp32 = ({
  id = 'esp32',
  x = 0,
  y = 0,
  boardKind = 'esp32',
  led = false,
}: Esp32Props) => {
  const ref = useRef<HTMLElement & { led?: boolean }>(null);
  useEffect(() => {
    if (ref.current) ref.current.led = led;
  }, [led]);
  return (
    <velxio-esp32
      ref={ref}
      id={id}
      board-kind={boardKind}
      style={{ position: 'absolute', left: `${x}px`, top: `${y}px` }}
    />
  );
};
