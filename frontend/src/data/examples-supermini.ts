/**
 * Examples for the two SuperMini boards (ESP32-C3 SuperMini, ESP32-S3
 * SuperMini) — small, cheap USB-C boards common in school kits.
 *
 * The same three circuits on both boards, so a class with mixed boards can do
 * the same lesson: blink an LED, read a button, measure a voltage with the
 * ADC. Pins are chosen to be free on both boards and away from the
 * boot-strapping pins (C3: GPIO 2/8/9; S3: GPIO 0/3/45/46).
 */
import type { ExampleProject } from './examples';

type Wire = ExampleProject['wires'][number];
type Component = ExampleProject['components'][number];

interface BoardInfo {
  kind: string;
  name: string;
  filter: 'esp32-c3' | 'esp32-s3';
  /** Pad names on the board element. */
  led: string;
  button: string;
  pot: string;
  gnd: string;
  v33: string;
  /** Board LED the sketch can mention, if the board has a plain one. */
  boardLed?: string;
  /** Pad name → GPIO number, for boards whose pads are not numbered (XIAO D0…). */
  gpio?: Record<string, number>;
  }

/** GPIO number of a pad, as the sketch has to write it. */
const g = (b: BoardInfo, pad: string): string => String(b.gpio?.[pad] ?? pad);
/** How a pad is named in prose: "GPIO 5", or "D1 (GPIO 2)" on a XIAO. */
const at = (b: BoardInfo, pad: string): string =>
  b.gpio?.[pad] !== undefined ? `${pad} (GPIO ${b.gpio[pad]})` : `GPIO ${pad}`;

const C3: BoardInfo = {
  kind: 'aitewinrobot-esp32c3-supermini',
  name: 'ESP32-C3 SuperMini',
  filter: 'esp32-c3',
  led: '5',
  button: '6',
  pot: '1',
  gnd: 'GND',
  v33: '3V3',
  boardLed: 'Die blaue LED auf dem Board hängt an GPIO 8 und leuchtet bei LOW.',
};

const S3: BoardInfo = {
  kind: 'esp32-s3-supermini',
  name: 'ESP32-S3 SuperMini',
  filter: 'esp32-s3',
  led: '5',
  button: '6',
  pot: '1',
  gnd: 'GND',
  v33: '3V3',
};

const w = (id: string, a: [string, string], b: [string, string], color: string): Wire => ({
  id,
  start: { componentId: a[0], pinName: a[1] },
  end: { componentId: b[0], pinName: b[1] },
  color,
});

function ledParts(b: BoardInfo): { components: Component[]; wires: Wire[] } {
  return {
    components: [
      { type: 'wokwi-resistor', id: 'r-led', x: 260, y: 120, properties: { value: '220' } },
      { type: 'wokwi-led', id: 'led-1', x: 380, y: 100, properties: { color: 'red' } },
    ],
    wires: [
      w('w-led-1', [b.kind, b.led], ['r-led', '1'], '#22aa44'),
      w('w-led-2', ['r-led', '2'], ['led-1', 'A'], '#22aa44'),
      w('w-led-3', ['led-1', 'C'], [b.kind, b.gnd], '#222222'),
    ],
  };
}

function blink(b: BoardInfo): ExampleProject {
  const { components, wires } = ledParts(b);
  return {
    id: `${b.kind}-blink`,
    title: `${b.name}: LED blinkt`,
    description: `Das erste Programm auf dem ${b.name}: Eine LED an ${at(b, b.led)} blinkt im Sekundentakt, der serielle Monitor zählt mit.`,
    category: 'basics',
    difficulty: 'beginner',
    boardFilter: b.filter,
    tags: ['supermini', b.filter, 'led', 'blink'],
    boards: [
      {
        boardKind: b.kind,
        x: 100,
        y: 100,
        code: `// ${b.name}: LED blinkt
// LED mit 220-Ω-Vorwiderstand an ${at(b, b.led)}, Kathode an GND.${b.boardLed ? `\n// ${b.boardLed}` : ''}

const int LED = ${g(b, b.led)};
int zaehler = 0;

void setup() {
  Serial.begin(115200);
  pinMode(LED, OUTPUT);
}

void loop() {
  digitalWrite(LED, HIGH);   // an (3,3 V)
  delay(500);
  digitalWrite(LED, LOW);    // aus
  delay(500);
  zaehler++;
  Serial.print("Blink Nr. ");
  Serial.println(zaehler);
}
`,
      },
    ],
    code: '',
    components,
    wires,
  };
}

function button(b: BoardInfo): ExampleProject {
  const led = ledParts(b);
  return {
    id: `${b.kind}-button`,
    title: `${b.name}: Taster schaltet LED`,
    description: `Ein Taster an ${at(b, b.button)} (mit internem Pull-up) schaltet die LED an ${at(b, b.led)}. Jeder Druck wird im seriellen Monitor gezählt.`,
    category: 'basics',
    difficulty: 'beginner',
    boardFilter: b.filter,
    tags: ['supermini', b.filter, 'button', 'input-pullup'],
    boards: [
      {
        boardKind: b.kind,
        x: 100,
        y: 100,
        code: `// ${b.name}: Taster schaltet LED
// Taster zwischen ${at(b, b.button)} und GND, LED an ${at(b, b.led)}.

const int TASTER = ${g(b, b.button)};
const int LED = ${g(b, b.led)};
bool vorher = HIGH;
int druecke = 0;

void setup() {
  Serial.begin(115200);
  pinMode(TASTER, INPUT_PULLUP);   // offen = HIGH, gedrückt = LOW
  pinMode(LED, OUTPUT);
}

void loop() {
  bool jetzt = digitalRead(TASTER);
  digitalWrite(LED, jetzt == LOW);
  if (vorher == HIGH && jetzt == LOW) {   // Flanke: gerade gedrückt
    druecke++;
    Serial.print("Gedrückt: ");
    Serial.println(druecke);
  }
  vorher = jetzt;
  delay(10);                              // Prellen abwarten
}
`,
      },
    ],
    code: '',
    components: [
      ...led.components,
      { type: 'wokwi-pushbutton', id: 'btn-1', x: 260, y: 220, properties: { color: 'blue' } },
    ],
    wires: [
      ...led.wires,
      w('w-btn-1', [b.kind, b.button], ['btn-1', '1.l'], '#3366ff'),
      w('w-btn-2', ['btn-1', '2.l'], [b.kind, b.gnd], '#222222'),
    ],
  };
}

function pot(b: BoardInfo): ExampleProject {
  return {
    id: `${b.kind}-adc-pot`,
    title: `${b.name}: Spannung messen`,
    description: `Ein Potentiometer teilt 3,3 V; der ADC an ${at(b, b.pot)} misst den Schleifer. Ausgabe als Rohwert (0–4095) und in Volt – auch im Plotter des seriellen Monitors.`,
    category: 'sensors',
    difficulty: 'beginner',
    boardFilter: b.filter,
    tags: ['supermini', b.filter, 'adc', 'potentiometer', 'plotter'],
    boards: [
      {
        boardKind: b.kind,
        x: 100,
        y: 100,
        code: `// ${b.name}: Spannung messen
// Poti: VCC an 3V3, GND an GND, Schleifer (SIG) an ${at(b, b.pot)}.
// Der ADC liefert 0 … 4095 (12 Bit) für 0 … 3,3 V.

const int POTI = ${g(b, b.pot)};

void setup() {
  Serial.begin(115200);
}

void loop() {
  int roh = analogRead(POTI);
  float volt = roh * 3.3 / 4095.0;
  // "Name:Wert"-Paare zeichnet der Plotter als eigene Kurven.
  Serial.print("Rohwert:");
  Serial.print(roh);
  Serial.print(" Volt:");
  Serial.println(volt, 3);
  delay(200);
}

// Tipp: Drehe während der Simulation am Poti und schalte im seriellen
// Monitor auf „Plotter“.
`,
      },
    ],
    code: '',
    components: [
      { type: 'wokwi-potentiometer', id: 'pot-1', x: 270, y: 110, properties: { value: 512 } },
    ],
    wires: [
      w('w-pot-1', [b.kind, b.v33], ['pot-1', 'VCC'], '#dd2222'),
      w('w-pot-2', ['pot-1', 'GND'], [b.kind, b.gnd], '#222222'),
      w('w-pot-3', ['pot-1', 'SIG'], [b.kind, b.pot], '#ff9900'),
    ],
  };
}

// XIAO ESP32-S3 Sense: XIAO S3 with the camera/mic board underneath. Pads are
// D0…D10; D0/D1/D2 = GPIO 1/2/3 (ADC1 CH0-2).
const XIAO_SENSE: BoardInfo = {
  kind: 'xiao-esp32s3-sense',
  name: 'XIAO ESP32-S3 Sense',
  filter: 'esp32-s3',
  led: 'D1',
  button: 'D2',
  pot: 'D0',
  gnd: 'GND',
  v33: '3V3',
  boardLed: 'Die gelbe LED auf dem Board hängt an GPIO 21 und leuchtet bei LOW.',
  gpio: { D0: 1, D1: 2, D2: 3 },
};

export const superminiExamples: ExampleProject[] = [C3, S3, XIAO_SENSE].flatMap((b) => [
  blink(b),
  button(b),
  pot(b),
]);
