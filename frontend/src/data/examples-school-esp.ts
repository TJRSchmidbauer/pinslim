/**
 * ESP32 variants of the school examples.
 *
 * The school collection runs on an ESP32 (DevKit V1 pinout), not on an Arduino
 * Uno: the boards in school hardware are ESP32s, and the simulator runs them
 * on its own QEMU machine. Each entry here replaces the Uno sketch and, where
 * the base circuit is wired to the Uno, the wiring is carried over with
 * `convertCircuit` below.
 *
 * What changes against the Uno versions, and is worth teaching:
 *  - logic level and ADC reference are 3,3 V (not 5 V)
 *  - the ADC has 12 bit (0 … 4095), so raw values and the resolution differ
 *  - GPIO numbers instead of D2 … D13; the pin table in `UNO_TO_GPIO` keeps
 *    clear of the flash pins and of the boot-strapping pins where it can
 *  - serial speed 115200 Baud
 */
import type { ExampleProject } from './examples';

/** Board the school examples run on. Its kind doubles as the component id. */
export const SCHOOL_ESP_BOARD = 'esp32';

/** Uno pin name → pad name on the ESP32 DevKit V1 element. */
export const UNO_TO_GPIO: Record<string, string> = {
  '2': '4',
  '3': '5',
  '4': '18',
  '5': '19',
  '6': '21',
  '7': '22',
  '8': '23',
  '9': '25',
  '10': '26',
  '11': '27',
  '12': '14',
  '13': '13',
  A0: '34',
  A1: '35',
  GND: 'GND2',
  '5V': '3V3',
};

/** Pad names the converted circuits may end up on (checked by a test). */
export const SCHOOL_ESP_PADS = new Set([
  ...Object.values(UNO_TO_GPIO),
  'VIN',
  '2',
  '16',
  '17',
]);

type Component = ExampleProject['components'][number];
type Wire = ExampleProject['wires'][number];

export interface EspVariant {
  /** Sketch for the ESP32 (replaces the Uno sketch). */
  code: string;
  /** Replaces the description (the Uno ones talk about the Arduino). */
  description?: string;
  /** Parts added on top of the base circuit (e.g. an LED the Uno had on board). */
  extraComponents?: Component[];
  /** Wires added on top (pad names are ESP32 pads, written out directly). */
  extraWires?: Wire[];
  /** Property overrides per component id, e.g. a different resistor value. */
  properties?: Record<string, Record<string, unknown>>;
  /** Uno pin → pad overrides for this entry only (e.g. 5V → VIN for an HC-SR04). */
  pinOverrides?: Record<string, string>;
  /** Run on another ESP32 board than the default (its kind is the component id). */
  boardKind?: string;
}

const mapPin = (pin: string, overrides?: Record<string, string>): string =>
  overrides?.[pin] ?? UNO_TO_GPIO[pin] ?? pin;

/** Re-wire a Uno circuit onto the ESP32 board. */
export function convertCircuit(
  src: { components: Component[]; wires: Wire[] },
  variant: EspVariant,
): { components: Component[]; wires: Wire[] } {
  const isBoard = (id: string) => id === 'arduino-uno';
  const components = src.components
    .filter((c) => !isBoard(c.id))
    .map((c) => ({
      ...c,
      properties: { ...c.properties, ...(variant.properties?.[c.id] ?? {}) },
    }));
  const fix = (e: Wire['start']): Wire['start'] =>
    isBoard(e.componentId)
      ? { ...e, componentId: variant.boardKind ?? SCHOOL_ESP_BOARD, pinName: mapPin(e.pinName, variant.pinOverrides) }
      : { ...e };
  const wires = src.wires.map((w) => ({ ...w, start: fix(w.start), end: fix(w.end) }));
  return {
    components: [...components, ...(variant.extraComponents ?? [])],
    wires: [...wires, ...(variant.extraWires ?? [])],
  };
}

const druckeKomma = `void druckeKomma(float wert, int stellen) {
  String text = String(wert, stellen);
  text.replace('.', ',');
  Serial.print(text);
}`;

export const ESP_VARIANTS: Record<string, EspVariant> = {
  'schule-blinken': {
    code: `// Die erste LED blinkt
// Eine LED mit Vorwiderstand hängt an GPIO 13.

void setup() {
  // setup() läuft genau einmal nach dem Start.
  pinMode(13, OUTPUT);       // GPIO 13 wird ein Ausgang
}

void loop() {
  // loop() wiederholt sich endlos.
  digitalWrite(13, HIGH);    // LED an  (3,3 V am Pin)
  delay(1000);               // 1000 ms = 1 s warten
  digitalWrite(13, LOW);     // LED aus (0 V am Pin)
  delay(1000);
}

// Aufgaben:
// 1) Lass die LED doppelt so schnell blinken.
// 2) Erzeuge ein Morse-SOS: dreimal kurz, dreimal lang, dreimal kurz.
`,
    description:
      'Das erste Programm: Eine LED an GPIO 13 geht im Sekundentakt an und aus. Lernziele: Aufbau eines Programms mit setup() und loop(), Ausgänge schalten, Wartezeiten.',
    extraComponents: [
      { type: 'wokwi-led', id: 'led-1', x: 460, y: 100, properties: { color: 'red' } },
      { type: 'wokwi-resistor', id: 'r-led', x: 320, y: 110, properties: { value: '220' } },
    ],
    extraWires: [
      { id: 'w1', start: { componentId: SCHOOL_ESP_BOARD, pinName: '13' }, end: { componentId: 'r-led', pinName: '1' }, color: '#22aa44' },
      { id: 'w2', start: { componentId: 'r-led', pinName: '2' }, end: { componentId: 'led-1', pinName: 'A' }, color: '#22aa44' },
      { id: 'w3', start: { componentId: 'led-1', pinName: 'C' }, end: { componentId: SCHOOL_ESP_BOARD, pinName: 'GND2' }, color: '#222222' },
    ],
  },

  'schule-taster': {
    code: `// Taster schaltet LED
// Taster an GPIO 4 (gegen GND), LED mit Vorwiderstand an GPIO 13.

const int TASTER = 4;
const int LED = 13;

void setup() {
  // INPUT_PULLUP schaltet einen internen Widerstand nach 3,3 V zu.
  // Nicht gedrückt: HIGH, gedrückt: LOW (Taster verbindet mit GND).
  pinMode(TASTER, INPUT_PULLUP);
  pinMode(LED, OUTPUT);
}

void loop() {
  if (digitalRead(TASTER) == LOW) {   // gedrückt?
    digitalWrite(LED, HIGH);
  } else {
    digitalWrite(LED, LOW);
  }
}

// Aufgaben:
// 1) Kehre die Logik um: LED aus, solange gedrückt wird.
// 2) Jeder Druck soll die LED umschalten (an → aus → an ...).
//    Tipp: Merke dir den vorherigen Tasterzustand in einer Variablen.
`,
  },

  'schule-dimmen': {
    code: `// LED dimmen mit PWM
// Ein Mikrocontroller kann keine „halbe Spannung“ ausgeben. Stattdessen
// schaltet er sehr schnell an und aus (PWM). Das Verhältnis von An- zu
// Auszeit bestimmt die mittlere Helligkeit.

const int LED = 25;       // beim ESP32 kann fast jeder Ausgangs-Pin PWM

int helligkeit = 0;       // 0 = aus, 255 = volle Helligkeit
int schritt = 5;          // um so viel ändert sich die Helligkeit

void setup() {
  pinMode(LED, OUTPUT);
}

void loop() {
  analogWrite(LED, helligkeit);
  helligkeit = helligkeit + schritt;

  // Am Rand die Richtung umkehren
  if (helligkeit <= 0 || helligkeit >= 255) {
    schritt = -schritt;
  }
  delay(30);
}

// Aufgabe: Öffne das Oszilloskop, füge GPIO 25 als Kanal hinzu und
// beobachte, wie sich die Pulsbreite ändert.
`,
  },

  'schule-seriell': {
    code: `// Ausgaben im seriellen Monitor
// Öffne den seriellen Monitor (Werkzeugleiste), um die Ausgaben zu sehen.

void setup() {
  Serial.begin(115200);               // Übertragungsrate: 115200 Baud
  Serial.println("Hallo, ich bin der ESP32!");
}

void loop() {
  Serial.print("Ich laufe seit ");
  Serial.print(millis() / 1000);      // millis(): Millisekunden seit Start
  Serial.println(" Sekunden.");
  delay(2000);
}

// Aufgabe: Gib zusätzlich die Laufzeit in Minuten und Sekunden aus,
// z. B. „1 min 23 s“. Tipp: Ganzzahldivision / und Rest %.
`,
  },

  'schule-ampel': {
    code: `// Ampel als Zustandsautomat
// Rot an GPIO 13, Gelb an GPIO 14, Grün an GPIO 27.
//
// Zustandsdiagramm:
//   ROT --3s--> ROTGELB --1s--> GRUEN --3s--> GELB --1s--> ROT

const int ROT_PIN = 13;
const int GELB_PIN = 14;
const int GRUEN_PIN = 27;

enum Zustand { ROT, ROTGELB, GRUEN, GELB };
Zustand zustand = ROT;

void lampen(bool rot, bool gelb, bool gruen) {
  digitalWrite(ROT_PIN, rot);
  digitalWrite(GELB_PIN, gelb);
  digitalWrite(GRUEN_PIN, gruen);
}

void setup() {
  pinMode(ROT_PIN, OUTPUT);
  pinMode(GELB_PIN, OUTPUT);
  pinMode(GRUEN_PIN, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  switch (zustand) {
    case ROT:
      Serial.println("Zustand: ROT");
      lampen(true, false, false);
      delay(3000);
      zustand = ROTGELB;          // Übergang
      break;
    case ROTGELB:
      Serial.println("Zustand: ROTGELB");
      lampen(true, true, false);
      delay(1000);
      zustand = GRUEN;
      break;
    case GRUEN:
      Serial.println("Zustand: GRUEN");
      lampen(false, false, true);
      delay(3000);
      zustand = GELB;
      break;
    case GELB:
      Serial.println("Zustand: GELB");
      lampen(false, true, false);
      delay(1000);
      zustand = ROT;
      break;
  }
}

// Aufgaben:
// 1) Zeichne das Zustandsdiagramm mit allen Ausgaben.
// 2) Ergänze einen Zustand AUS, in dem nur Gelb blinkt (Nachtbetrieb).
`,
  },

  'schule-lauflicht': {
    code: `// Lauflicht mit Schleife und Feld
// Fünf LEDs an den GPIO-Pins 4, 5, 18, 19 und 21.

const int ANZAHL = 5;
const int LEDS[ANZAHL] = {4, 5, 18, 19, 21};   // Feld mit den Pinnummern

void setup() {
  for (int i = 0; i < ANZAHL; i++) {
    pinMode(LEDS[i], OUTPUT);
  }
}

void loop() {
  // Vorwärts einschalten
  for (int i = 0; i < ANZAHL; i++) {
    digitalWrite(LEDS[i], HIGH);
    delay(200);
  }
  // Rückwärts ausschalten
  for (int i = ANZAHL - 1; i >= 0; i--) {
    digitalWrite(LEDS[i], LOW);
    delay(200);
  }
}

// Aufgaben:
// 1) Es soll immer nur EINE LED leuchten, die hin- und herwandert.
// 2) Lege die Wartezeit in einer Variablen fest und halbiere sie nach
//    jedem Durchlauf, bis sie 25 ms erreicht.
`,
  },

  'schule-binaerzaehler': {
    code: `// Binärzähler mit 4 LEDs
// LED an GPIO 4 = 2^0 (Einer), GPIO 5 = 2^1, GPIO 18 = 2^2, GPIO 19 = 2^3.

const int LEDS[4] = {4, 5, 18, 19};   // niedrigstes Bit zuerst

int zahl = 0;

void setup() {
  for (int bit = 0; bit < 4; bit++) {
    pinMode(LEDS[bit], OUTPUT);
  }
  Serial.begin(115200);
}

void loop() {
  for (int bit = 0; bit < 4; bit++) {
    // (zahl >> bit) schiebt das gewünschte Bit nach rechts,
    // & 1 blendet alle anderen Bits aus.
    int wert = (zahl >> bit) & 1;
    digitalWrite(LEDS[bit], wert);
  }

  Serial.print(zahl);
  Serial.print(" = ");
  Serial.println(zahl, BIN);       // Ausgabe im Dualsystem

  zahl = (zahl + 1) % 16;          // nach 15 wieder bei 0 beginnen
  delay(800);
}

// Aufgabe: Ändere das Programm so, dass rückwärts von 15 bis 0 gezählt wird.
`,
  },

  'schule-siebensegment': {
    code: `// 7-Segment-Anzeige mit zweidimensionalem Feld
// Segmente a bis g an GPIO 4, 5, 18, 19, 21, 22, 23; gemeinsame Kathode.
//
//      aaa
//     f   b
//      ggg
//     e   c
//      ddd

const int SEGMENT[7] = {4, 5, 18, 19, 21, 22, 23};   // a, b, c, d, e, f, g

// Muster je Ziffer: 1 = Segment leuchtet
const bool ZIFFER[10][7] = {
  {1,1,1,1,1,1,0},  // 0
  {0,1,1,0,0,0,0},  // 1
  {1,1,0,1,1,0,1},  // 2
  {1,1,1,1,0,0,1},  // 3
  {0,1,1,0,0,1,1},  // 4
  {1,0,1,1,0,1,1},  // 5
  {1,0,1,1,1,1,1},  // 6
  {1,1,1,0,0,0,0},  // 7
  {1,1,1,1,1,1,1},  // 8
  {1,1,1,1,0,1,1},  // 9
};

void zeige(int ziffer) {
  for (int s = 0; s < 7; s++) {
    digitalWrite(SEGMENT[s], ZIFFER[ziffer][s]);
  }
}

void setup() {
  for (int s = 0; s < 7; s++) {
    pinMode(SEGMENT[s], OUTPUT);
  }
}

void loop() {
  for (int z = 0; z <= 9; z++) {
    zeige(z);
    delay(800);
  }
}

// Aufgabe: Erweitere die Tabelle um die Buchstaben A, b, C, d, E, F,
// sodass Hexadezimalziffern angezeigt werden können.
`,
  },

  'schule-vorwiderstand': {
    code: `// LED mit Vorwiderstand berechnen
// Versorgung: U_B = 3,3 V (GPIO 13 auf HIGH)
// Rote LED:   U_LED ≈ 2 V, gewünschter Strom I = 5 mA
//
//   R = (U_B − U_LED) / I = (3,3 V − 2 V) / 0,005 A = 260 Ω
//   Nächster Normwert: 270 Ω
//
// Tipp: Doppelklicke auf den Widerstand, um seinen Wert zu ändern.
// Was passiert mit der Helligkeit bei 1 kΩ oder bei 100 Ω?
// (Ein GPIO des ESP32 darf dauerhaft nur etwa 12 mA liefern.)

void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}
`,
    properties: { r1: { value: '270' } },
  },

  'schule-spannung-messen': {
    description:
      'Ein Potentiometer stellt eine Spannung zwischen 0 und 3,3 V ein; der ESP32 misst sie. Die Ausgabe ist eine Messtabelle für die Tabellenkalkulation. Lernziele: Analog-Digital-Wandlung, Auflösung (12 Bit), Umrechnung in Volt.',
    code: `// Spannung messen mit dem Analog-Digital-Wandler (ADC)
// Potentiometer-Schleifer an GPIO 34.
//
// Der ADC des ESP32 liefert ganze Zahlen von 0 bis 4095 (12 Bit).
// 0 entspricht 0 V, 4095 entspricht 3,3 V.
//
// Die Ausgabe ist eine Tabelle mit Semikolon und Dezimalkomma –
// im seriellen Monitor markieren, kopieren und in Excel/LibreOffice
// einfügen.

${druckeKomma}

void setup() {
  Serial.begin(115200);
  Serial.println("t in s;Rohwert;U in V");
}

void loop() {
  int rohwert = analogRead(34);
  float spannung = rohwert * 3.3 / 4095.0;

  druckeKomma(millis() / 1000.0, 1);
  Serial.print(';');
  Serial.print(rohwert);
  Serial.print(';');
  druckeKomma(spannung, 3);
  Serial.println();

  delay(500);
}

// Aufgabe: Wie groß ist die kleinste Spannungsänderung, die der ADC
// noch unterscheiden kann? (Auflösung = 3,3 V / 4095)
`,
  },

  'schule-teiler-messen': {
    description:
      'Der ESP32 misst die Mittenspannung eines Spannungsteilers aus zwei Widerständen und vergleicht sie mit dem berechneten Wert. Lernziele: Theorie und Messung vergleichen, relative Abweichung.',
    code: `// Spannungsteiler nachmessen
// 3,3 V → R1 → GPIO 34 → R2 → GND
// Trage hier die Werte der Widerstände ein (Doppelklick auf die Bauteile):
const float R1 = 10000.0;   // in Ohm
const float R2 = 10000.0;   // in Ohm
const float U  = 3.3;       // Versorgungsspannung in V

void setup() {
  Serial.begin(115200);
  float theorie = U * R2 / (R1 + R2);
  Serial.print("Berechnet: U2 = ");
  Serial.print(theorie, 3);
  Serial.println(" V");
}

void loop() {
  float gemessen = analogRead(34) * U / 4095.0;
  float theorie = U * R2 / (R1 + R2);
  float abweichung = (gemessen - theorie) / theorie * 100.0;

  Serial.print("Gemessen: ");
  Serial.print(gemessen, 3);
  Serial.print(" V   Abweichung: ");
  Serial.print(abweichung, 1);
  Serial.println(" %");
  delay(1000);
}

// Aufgabe: Ändere R2 auf 4,7 kΩ (Bauteil UND Programm). Stimmen
// Rechnung und Messung überein?
`,
  },

  'schule-temperatur': {
    description:
      'Ein NTC-Widerstand ändert seinen Widerstand mit der Temperatur. Der ESP32 berechnet daraus die Temperatur. Lernziele: temperaturabhängiger Widerstand, Spannungsteiler als Sensorschaltung, Kennlinie.',
    code: `// Temperatur messen mit einem Heißleiter (NTC)
// Sensor-Modul: OUT → GPIO 35, VCC → 3,3 V, GND → GND
// Auf dem Modul bilden ein fester Widerstand (10 kΩ) und der NTC
// einen Spannungsteiler. Wird es wärmer, sinkt der NTC-Widerstand.
//
// Tipp: Klicke während der Simulation auf den Sensor, um die
// Temperatur zu verstellen.

const float U = 3.3;
const float R_FEST = 10000.0;    // fester Widerstand in Ω
const float R_25 = 10000.0;      // NTC-Widerstand bei 25 °C
const float B = 3950.0;          // Materialkonstante des NTC
const float T_25 = 298.15;       // 25 °C in Kelvin

void setup() {
  Serial.begin(115200);
  Serial.println("U in V;R_NTC in Ohm;T in °C");
}

void loop() {
  float spannung = analogRead(35) * U / 4095.0;
  float r_ntc = R_FEST * spannung / (U - spannung);

  // B-Parameter-Gleichung: 1/T = 1/T25 + ln(R/R25) / B
  float kelvin = 1.0 / (1.0 / T_25 + log(r_ntc / R_25) / B);
  float celsius = kelvin - 273.15;

  Serial.print(spannung, 3);
  Serial.print(';');
  Serial.print(r_ntc, 0);
  Serial.print(';');
  Serial.println(celsius, 1);
  delay(1000);
}

// Aufgabe: Stelle am Sensor verschiedene Temperaturen ein und trage
// R_NTC über T auf. Welche Form hat die Kennlinie?
`,
  },

  'schule-ultraschall': {
    // The HC-SR04 is a 5 V part: it gets VIN (USB 5 V). Its ECHO output is also
    // 5 V — on real hardware a voltage divider belongs between ECHO and the
    // ESP32 pin (the sketch comment says so).
    pinOverrides: { '5V': 'VIN' },
    code: `// Abstand messen mit Ultraschall (HC-SR04)
// TRIG → GPIO 25, ECHO → GPIO 26, VCC → VIN (5 V), GND → GND
//
// Der Sensor sendet einen kurzen Schallimpuls. ECHO bleibt so lange auf
// HIGH, bis das Echo zurückkommt. Der Schall legt den Weg zweimal zurück.
//
// Achtung am echten Aufbau: ECHO liefert 5 V, ein ESP32-Pin verträgt nur
// 3,3 V. Dort gehört ein Spannungsteiler (z. B. 1 kΩ / 2 kΩ) zwischen
// ECHO und den Pin.
//
// Tipp: Klicke während der Simulation auf den Sensor, um den Abstand
// zu verändern.

const int TRIG = 25;
const int ECHO = 26;
const float SCHALL = 343.0;      // Schallgeschwindigkeit in m/s bei 20 °C

void setup() {
  Serial.begin(115200);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  Serial.println("Laufzeit in µs;Abstand in cm");
}

void loop() {
  // 10 µs langer Startimpuls
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);

  // Dauer des Echo-Impulses in Mikrosekunden (max. 30 ms warten)
  unsigned long laufzeit = pulseIn(ECHO, HIGH, 30000UL);

  if (laufzeit == 0) {
    Serial.println("kein Echo (zu weit entfernt)");
  } else {
    // s = v · t / 2   (t in s, s in m) → umgerechnet in cm
    float abstand_cm = SCHALL * (laufzeit / 1000000.0) / 2.0 * 100.0;
    Serial.print(laufzeit);
    Serial.print(';');
    Serial.println(abstand_cm, 1);
  }
  delay(500);
}

// Aufgabe: Bei 0 °C beträgt die Schallgeschwindigkeit nur 331 m/s.
// Wie groß ist der Messfehler bei 2 m Abstand, wenn man das nicht
// berücksichtigt?
`,
  },

  'schule-licht': {
    code: `// Helligkeit messen mit einem Fotowiderstand (LDR)
// Sensor-Modul: AO → GPIO 34, LED mit Vorwiderstand an GPIO 25 (PWM)
//
// Tipp: Klicke während der Simulation auf den Sensor, um die
// Beleuchtungsstärke zu verändern.

const int SENSOR = 34;
const int LED = 25;

void setup() {
  Serial.begin(115200);
  pinMode(LED, OUTPUT);
  Serial.println("Rohwert;Helligkeit in %;LED (0-255)");
}

void loop() {
  int rohwert = analogRead(SENSOR);                  // 0 bis 4095
  int prozent = map(rohwert, 0, 4095, 0, 100);
  int led = map(rohwert, 0, 4095, 255, 0);           // je dunkler, desto heller die LED
  analogWrite(LED, led);

  Serial.print(rohwert);
  Serial.print(';');
  Serial.print(prozent);
  Serial.print(';');
  Serial.println(led);
  delay(300);
}

// Aufgabe: Baue ein Dämmerungslicht: Die LED soll erst unterhalb von
// 30 % Helligkeit angehen und dann ganz hell leuchten.
`,
  },

  // Wemos Lolin32 Lite: the pads are named GPIOxx, supply is "3V" (no 5 V pad).
  'schule-lolin-blinken': {
    boardKind: 'wemos-lolin32-lite',
    description:
      'Das erste Programm auf dem Wemos Lolin32 Lite: Eine LED an GPIO 23 blinkt im Sekundentakt, der serielle Monitor zählt mit. Lernziele: setup() und loop(), Ausgänge schalten, serielle Ausgabe.',
    code: `// Erstes Programm auf dem Wemos Lolin32 Lite
// Externe LED mit Vorwiderstand an GPIO 23.
// (Die blaue LED auf dem Board hängt an GPIO 22 und leuchtet bei LOW.)

const int LED = 23;

void setup() {
  Serial.begin(115200);
  pinMode(LED, OUTPUT);
}

void loop() {
  digitalWrite(LED, HIGH);
  Serial.println("LED an");
  delay(1000);
  digitalWrite(LED, LOW);
  Serial.println("LED aus");
  delay(1000);
}

// Aufgaben:
// 1) Lass die LED doppelt so schnell blinken.
// 2) Schalte statt der externen die Board-LED an GPIO 22.
//    Achtung: Sie leuchtet bei LOW, nicht bei HIGH.
`,
    extraComponents: [
      { type: 'wokwi-led', id: 'led-1', x: 400, y: 100, properties: { color: 'red' } },
      { type: 'wokwi-resistor', id: 'r-led', x: 300, y: 110, properties: { value: '220' } },
    ],
    extraWires: [
      { id: 'w1', start: { componentId: 'wemos-lolin32-lite', pinName: 'GPIO23' }, end: { componentId: 'r-led', pinName: '1' }, color: '#22aa44' },
      { id: 'w2', start: { componentId: 'r-led', pinName: '2' }, end: { componentId: 'led-1', pinName: 'A' }, color: '#22aa44' },
      { id: 'w3', start: { componentId: 'led-1', pinName: 'C' }, end: { componentId: 'wemos-lolin32-lite', pinName: 'GND' }, color: '#222222' },
    ],
  },

  'schule-kondensator': {
    description:
      'Ein Kondensator (100 µF) wird über einen Widerstand (10 kΩ) geladen; der ESP32 nimmt die Ladekurve auf. Lernziele: Zeitkonstante τ = R · C, exponentieller Verlauf, Auswertung in der Tabellenkalkulation.',
    code: `// Aufladen eines Kondensators
// GPIO 23 → 10 kΩ → GPIO 34 → 100 µF → GND
// Zeitkonstante: τ = R · C = 10 000 Ω · 0,0001 F = 1 s
//
// Theorie: U_C(t) = U0 · (1 − e^(−t/τ))   mit U0 = 3,3 V
// Nach t = τ ist der Kondensator auf ca. 63 % von U0 geladen.
//
// Ausgabe als Tabelle (Semikolon, Dezimalkomma) für Excel/LibreOffice.

const unsigned long DAUER_MS = 6000;   // 6 τ messen
unsigned long start;

${druckeKomma}

void setup() {
  Serial.begin(115200);
  pinMode(23, OUTPUT);
  digitalWrite(23, LOW);         // erst entladen
  delay(3000);
  Serial.println("t in s;U_C in V");
  start = millis();
  digitalWrite(23, HIGH);        // Ladevorgang starten
}

void loop() {
  unsigned long t = millis() - start;
  if (t > DAUER_MS) return;      // Messung beendet

  float u = analogRead(34) * 3.3 / 4095.0;
  druckeKomma(t / 1000.0, 2);
  Serial.print(';');
  druckeKomma(u, 3);
  Serial.println();
  delay(100);
}

// Aufgaben:
// 1) Bestimme τ aus der Messung (63-%-Wert) und vergleiche mit R · C.
// 2) Trage ln(1 − U_C/U0) über t auf. Was ergibt sich, und wie hängt
//    die Steigung mit τ zusammen?
`,
  },
};

/** Apply an ESP32 variant to a school example built from a Uno base. */
export function toEsp32(
  ex: ExampleProject,
  variant: EspVariant,
): ExampleProject {
  const { components, wires } = convertCircuit(ex, variant);
  return {
    ...ex,
    description: variant.description ?? ex.description,
    boardType: variant.boardKind ?? SCHOOL_ESP_BOARD,
    boardFilter: 'esp32',
    boards: [{ boardKind: variant.boardKind ?? SCHOOL_ESP_BOARD, x: 100, y: 100, code: variant.code }],
    // Own screenshot (examples-thumbs/<id>.webp): the base example's picture
    // shows the Uno circuit.
    thumbnail: undefined,
    code: '',
    components,
    wires,
  };
}
