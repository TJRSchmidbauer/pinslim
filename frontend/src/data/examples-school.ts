/**
 * Pinslim school collection — examples arranged by teaching topic for
 * Gymnasium physics and computer science, shown when the gallery is
 * switched to "Schule".
 *
 * Every entry reuses the canvas (parts + wires) of a proven gallery example
 * and replaces title, description and — where the board runs code — the
 * sketch with a German, commented version written for lessons. Reusing
 * the circuits keeps them correct: they are the same ones the upstream test
 * suite exercises, so a school example cannot drift into an unwired or
 * non-converging circuit.
 *
 * Measurement sketches print semicolon-separated values with a decimal
 * comma, so the Serial Monitor output pastes straight into a German
 * spreadsheet (Excel / LibreOffice) for tables and regression lines.
 */
import type { ExampleProject } from './examples';
import { ESP_VARIANTS, toEsp32 } from './examples-school-esp';

export interface SchoolTopic {
  id: string;
  title: string;
  /** Subject and level, shown under the topic heading. */
  subject: string;
}

export const SCHOOL_TOPICS: SchoolTopic[] = [
  { id: 'start', title: 'Erste Schritte mit dem Mikrocontroller', subject: 'Informatik / Natur und Technik' },
  { id: 'algo', title: 'Algorithmen und Zustandsautomaten', subject: 'Informatik' },
  { id: 'strom', title: 'Der elektrische Stromkreis', subject: 'Physik, Mittelstufe' },
  { id: 'messen', title: 'Messen mit dem Mikrocontroller', subject: 'Physik / Informatik' },
  { id: 'halbleiter', title: 'Halbleiter, Kondensator und Schwingungen', subject: 'Physik, Mittel- und Oberstufe' },
  { id: 'logik', title: 'Logikgatter und Rechnen mit Bits', subject: 'Informatik' },
];

interface SchoolEntry {
  id: string;
  /** Gallery example whose circuit is reused. */
  base: string;
  topic: string;
  title: string;
  description: string;
  difficulty: ExampleProject['difficulty'];
  /** German sketch; omitted for circuits without a microcontroller. */
  code?: string;
}

const ANALOG_ONLY = `// Diese Schaltung kommt ohne Mikrocontroller aus.
// Starte die Simulation mit „Ausführen“; die Messgeräte zeigen die Werte
// direkt auf der Zeichenfläche. Ändere Bauteilwerte per Doppelklick.
void setup() {}
void loop() {}
`;

const LOGIC_ONLY = `// Reine Digitalschaltung ohne Mikrocontroller.
// Starte die Simulation mit „Ausführen“ und klicke dann auf die
// Schiebeschalter, um die Eingänge der Gatter zu setzen.
void setup() {}
void loop() {}
`;

const ENTRIES: SchoolEntry[] = [
  // ── Erste Schritte ────────────────────────────────────────────────────────
  {
    id: 'schule-blinken',
    base: 'blink-led',
    topic: 'start',
    title: 'Die erste LED blinkt',
    description:
      'Das erste Programm: Die eingebaute LED an Pin 13 geht im Sekundentakt an und aus. Lernziele: Aufbau eines Arduino-Programms mit setup() und loop(), Ausgänge schalten, Wartezeiten.',
    difficulty: 'beginner',
    code: `// Die erste LED blinkt
// Die LED auf dem Board hängt an Pin 13.

void setup() {
  // setup() läuft genau einmal nach dem Start.
  pinMode(13, OUTPUT);       // Pin 13 wird ein Ausgang
}

void loop() {
  // loop() wiederholt sich endlos.
  digitalWrite(13, HIGH);    // LED an  (5 V am Pin)
  delay(1000);               // 1000 ms = 1 s warten
  digitalWrite(13, LOW);     // LED aus (0 V am Pin)
  delay(1000);
}

// Aufgaben:
// 1) Lass die LED doppelt so schnell blinken.
// 2) Erzeuge ein Morse-SOS: dreimal kurz, dreimal lang, dreimal kurz.
`,
  },
  {
    id: 'schule-taster',
    base: 'button-led',
    topic: 'start',
    title: 'Taster schaltet LED',
    description:
      'Solange der Taster gedrückt ist, leuchtet die LED. Lernziele: Eingänge lesen, Pull-up-Widerstand, Verzweigung mit if/else.',
    difficulty: 'beginner',
    code: `// Taster schaltet LED
// Taster an Pin 2 (gegen GND), LED mit Vorwiderstand an Pin 13.

const int TASTER = 2;
const int LED = 13;

void setup() {
  // INPUT_PULLUP schaltet einen internen Widerstand nach 5 V zu.
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
  {
    id: 'schule-dimmen',
    base: 'fade-led',
    topic: 'start',
    title: 'LED dimmen mit PWM',
    description:
      'Die LED wird langsam heller und dunkler. Lernziele: Pulsweitenmodulation (PWM), analogWrite(), Variablen und Bedingungen.',
    difficulty: 'beginner',
    code: `// LED dimmen mit PWM
// Ein Mikrocontroller kann keine „halbe Spannung“ ausgeben. Stattdessen
// schaltet er sehr schnell an und aus (PWM). Das Verhältnis von An- zu
// Auszeit bestimmt die mittlere Helligkeit.

const int LED = 9;        // nur Pins mit ~ können PWM (3, 5, 6, 9, 10, 11)

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

// Aufgabe: Öffne das Oszilloskop, füge Pin 9 als Kanal hinzu und
// beobachte, wie sich die Pulsbreite ändert.
`,
  },
  {
    id: 'schule-seriell',
    base: 'serial-hello',
    topic: 'start',
    title: 'Ausgaben im seriellen Monitor',
    description:
      'Der Mikrocontroller meldet sich und gibt die Laufzeit aus. Lernziele: serielle Schnittstelle, Text und Zahlen ausgeben, millis().',
    difficulty: 'beginner',
    code: `// Ausgaben im seriellen Monitor
// Öffne den seriellen Monitor (Werkzeugleiste), um die Ausgaben zu sehen.

void setup() {
  Serial.begin(9600);                 // Übertragungsrate: 9600 Baud
  Serial.println("Hallo, ich bin der Arduino!");
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

  // ── Algorithmen und Zustandsautomaten ────────────────────────────────────
  {
    id: 'schule-ampel',
    base: 'traffic-light',
    topic: 'algo',
    title: 'Ampel als Zustandsautomat',
    description:
      'Eine Verkehrsampel, programmiert als Zustandsautomat mit den Zuständen ROT, ROTGELB, GRUEN und GELB. Lernziele: Zustände und Übergänge, switch-case, Aufzählungstyp.',
    difficulty: 'intermediate',
    code: `// Ampel als Zustandsautomat
// Rot an Pin 13, Gelb an Pin 12, Grün an Pin 11.
//
// Zustandsdiagramm:
//   ROT --3s--> ROTGELB --1s--> GRUEN --3s--> GELB --1s--> ROT

const int ROT_PIN = 13;
const int GELB_PIN = 12;
const int GRUEN_PIN = 11;

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
  Serial.begin(9600);
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
  {
    id: 'schule-lauflicht',
    base: 'multi-led-bar',
    topic: 'algo',
    title: 'Lauflicht mit Schleife und Feld',
    description:
      'Fünf LEDs werden nacheinander ein- und wieder ausgeschaltet. Lernziele: for-Schleife, Felder (Arrays), Zählschleifen vorwärts und rückwärts.',
    difficulty: 'beginner',
    code: `// Lauflicht mit Schleife und Feld
// Fünf LEDs an den Pins 2 bis 6.

const int ANZAHL = 5;
const int LEDS[ANZAHL] = {2, 3, 4, 5, 6};   // Feld mit den Pinnummern

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
  {
    id: 'schule-binaerzaehler',
    base: 'binary-counter-leds',
    topic: 'algo',
    title: 'Binärzähler mit 4 LEDs',
    description:
      'Die LEDs zeigen die Zahlen 0 bis 15 im Dualsystem. Lernziele: Stellenwertsysteme, Bits, Bitoperationen (Verschieben und Maskieren).',
    difficulty: 'intermediate',
    code: `// Binärzähler mit 4 LEDs
// LED an Pin 2 = 2^0 (Einer), Pin 3 = 2^1, Pin 4 = 2^2, Pin 5 = 2^3.

int zahl = 0;

void setup() {
  for (int pin = 2; pin <= 5; pin++) {
    pinMode(pin, OUTPUT);
  }
  Serial.begin(9600);
}

void loop() {
  for (int bit = 0; bit < 4; bit++) {
    // (zahl >> bit) schiebt das gewünschte Bit nach rechts,
    // & 1 blendet alle anderen Bits aus.
    int wert = (zahl >> bit) & 1;
    digitalWrite(bit + 2, wert);
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
  {
    id: 'schule-siebensegment',
    base: 'uno-7segment',
    topic: 'algo',
    title: '7-Segment-Anzeige mit zweidimensionalem Feld',
    description:
      'Eine 7-Segment-Anzeige zählt von 0 bis 9. Die Muster der Ziffern stehen in einer Tabelle. Lernziele: zweidimensionale Felder, Funktionen mit Parametern.',
    difficulty: 'intermediate',
    code: `// 7-Segment-Anzeige mit zweidimensionalem Feld
// Segmente a bis g an den Pins 2 bis 8, gemeinsame Kathode.
//
//      aaa
//     f   b
//      ggg
//     e   c
//      ddd

const int SEGMENT[7] = {2, 3, 4, 5, 6, 7, 8};   // a, b, c, d, e, f, g

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

  // ── Der elektrische Stromkreis ───────────────────────────────────────────
  {
    id: 'schule-reihenschaltung',
    base: 'an-series-resistors',
    topic: 'strom',
    title: 'Reihenschaltung von Widerständen',
    description:
      'Drei Widerstände (1 kΩ, 2,2 kΩ, 4,7 kΩ) liegen in Reihe an 10 V. Das Amperemeter misst den Strom. Lernziele: In der Reihenschaltung ist die Stromstärke überall gleich; R_ges = R1 + R2 + R3.',
    difficulty: 'beginner',
    code: ANALOG_ONLY,
  },
  {
    id: 'schule-parallelschaltung',
    base: 'an-parallel-resistors',
    topic: 'strom',
    title: 'Parallelschaltung von Widerständen',
    description:
      'Drei gleiche Widerstände (je 1 kΩ) liegen parallel an 5 V. Das Amperemeter misst den Gesamtstrom. Lernziele: Ströme addieren sich; 1/R_ges = 1/R1 + 1/R2 + 1/R3.',
    difficulty: 'beginner',
    code: ANALOG_ONLY,
  },
  {
    id: 'schule-spannungsteiler',
    base: 'an-voltage-divider',
    topic: 'strom',
    title: 'Spannungsteiler',
    description:
      'Zwei Widerstände teilen eine Spannung von 5 V. Das Voltmeter zeigt die Teilspannung an R2. Lernziele: U2 = U · R2 / (R1 + R2); Teilspannungen verhalten sich wie die Widerstände.',
    difficulty: 'beginner',
    code: ANALOG_ONLY,
  },
  {
    id: 'schule-vorwiderstand',
    base: 'led-current-limiting',
    topic: 'strom',
    title: 'LED mit Vorwiderstand berechnen',
    description:
      'Eine LED braucht einen Vorwiderstand, der den Strom begrenzt. Lernziele: Durchlassspannung, Ohmsches Gesetz, R = (U_B − U_LED) / I.',
    difficulty: 'beginner',
    code: `// LED mit Vorwiderstand berechnen
// Versorgung: U_B = 5 V (Pin 13 auf HIGH)
// Rote LED:   U_LED ≈ 2 V, gewünschter Strom I = 10 mA
//
//   R = (U_B − U_LED) / I = (5 V − 2 V) / 0,010 A = 300 Ω
//   Nächster Normwert: 330 Ω
//
// Tipp: Doppelklicke auf den Widerstand, um seinen Wert zu ändern.
// Was passiert mit der Helligkeit bei 1 kΩ oder bei 100 Ω?

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
  },

  // ── Messen mit dem Mikrocontroller ───────────────────────────────────────
  {
    id: 'schule-spannung-messen',
    base: 'pot-adc-reader',
    topic: 'messen',
    title: 'Spannung messen mit dem Analog-Digital-Wandler',
    description:
      'Ein Potentiometer stellt eine Spannung zwischen 0 und 5 V ein; der Arduino misst sie. Die Ausgabe ist eine Messtabelle für die Tabellenkalkulation. Lernziele: Analog-Digital-Wandlung, Auflösung (10 Bit), Umrechnung in Volt.',
    difficulty: 'beginner',
    code: `// Spannung messen mit dem Analog-Digital-Wandler (ADC)
// Potentiometer-Schleifer an A0.
//
// Der ADC liefert ganze Zahlen von 0 bis 1023 (10 Bit).
// 0 entspricht 0 V, 1023 entspricht 5 V.
//
// Die Ausgabe ist eine Tabelle mit Semikolon und Dezimalkomma –
// im seriellen Monitor markieren, kopieren und in Excel/LibreOffice
// einfügen.

void druckeKomma(float wert, int stellen) {
  String text = String(wert, stellen);
  text.replace('.', ',');
  Serial.print(text);
}

void setup() {
  Serial.begin(9600);
  Serial.println("t in s;Rohwert;U in V");
}

void loop() {
  int rohwert = analogRead(A0);
  float spannung = rohwert * 5.0 / 1023.0;

  druckeKomma(millis() / 1000.0, 1);
  Serial.print(';');
  Serial.print(rohwert);
  Serial.print(';');
  druckeKomma(spannung, 3);
  Serial.println();

  delay(500);
}

// Aufgabe: Wie groß ist die kleinste Spannungsänderung, die der ADC
// noch unterscheiden kann? (Auflösung = 5 V / 1023)
`,
  },
  {
    id: 'schule-teiler-messen',
    base: 'voltage-divider',
    topic: 'messen',
    title: 'Spannungsteiler nachmessen',
    description:
      'Der Arduino misst die Mittenspannung eines Spannungsteilers aus zwei Widerständen und vergleicht sie mit dem berechneten Wert. Lernziele: Theorie und Messung vergleichen, relative Abweichung.',
    difficulty: 'beginner',
    code: `// Spannungsteiler nachmessen
// 5 V → R1 → A0 → R2 → GND
// Trage hier die Werte der Widerstände ein (Doppelklick auf die Bauteile):
const float R1 = 10000.0;   // in Ohm
const float R2 = 10000.0;   // in Ohm
const float U  = 5.0;       // Versorgungsspannung in V

void setup() {
  Serial.begin(9600);
  float theorie = U * R2 / (R1 + R2);
  Serial.print("Berechnet: U2 = ");
  Serial.print(theorie, 3);
  Serial.println(" V");
}

void loop() {
  float gemessen = analogRead(A0) * U / 1023.0;
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
  {
    id: 'schule-temperatur',
    base: 'uno-ntc',
    topic: 'messen',
    title: 'Temperatur messen mit einem Heißleiter (NTC)',
    description:
      'Ein NTC-Widerstand ändert seinen Widerstand mit der Temperatur. Der Arduino berechnet daraus die Temperatur. Lernziele: temperaturabhängiger Widerstand, Spannungsteiler als Sensorschaltung, Kennlinie.',
    difficulty: 'intermediate',
    code: `// Temperatur messen mit einem Heißleiter (NTC)
// Sensor-Modul: OUT → A1, VCC → 5 V, GND → GND
// Auf dem Modul bilden ein fester Widerstand (10 kΩ) und der NTC
// einen Spannungsteiler. Wird es wärmer, sinkt der NTC-Widerstand.
//
// Tipp: Klicke während der Simulation auf den Sensor, um die
// Temperatur zu verstellen.

const float U = 5.0;
const float R_FEST = 10000.0;    // fester Widerstand in Ω
const float R_25 = 10000.0;      // NTC-Widerstand bei 25 °C
const float B = 3950.0;          // Materialkonstante des NTC
const float T_25 = 298.15;       // 25 °C in Kelvin

void setup() {
  Serial.begin(9600);
  Serial.println("U in V;R_NTC in Ohm;T in °C");
}

void loop() {
  float spannung = analogRead(A1) * U / 1023.0;
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
  {
    id: 'schule-ultraschall',
    base: 'uno-hcsr04',
    topic: 'messen',
    title: 'Abstand messen mit Ultraschall',
    description:
      'Ein Ultraschallsensor sendet einen Schallimpuls und misst die Laufzeit des Echos. Lernziele: Schallgeschwindigkeit, s = v · t / 2, Laufzeitmessung.',
    difficulty: 'intermediate',
    code: `// Abstand messen mit Ultraschall (HC-SR04)
// TRIG → Pin 9, ECHO → Pin 10
//
// Der Sensor sendet einen kurzen Schallimpuls. ECHO bleibt so lange auf
// HIGH, bis das Echo zurückkommt. Der Schall legt den Weg zweimal zurück.
//
// Tipp: Klicke während der Simulation auf den Sensor, um den Abstand
// zu verändern.

const int TRIG = 9;
const int ECHO = 10;
const float SCHALL = 343.0;      // Schallgeschwindigkeit in m/s bei 20 °C

void setup() {
  Serial.begin(9600);
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
  {
    id: 'schule-licht',
    base: 'uno-photoresistor',
    topic: 'messen',
    title: 'Helligkeit messen mit einem Fotowiderstand',
    description:
      'Ein Fotowiderstand (LDR) misst die Helligkeit; eine LED wird im Dunkeln heller. Lernziele: lichtabhängiger Widerstand, map()-Funktion, Regelung als einfaches Beispiel.',
    difficulty: 'beginner',
    code: `// Helligkeit messen mit einem Fotowiderstand (LDR)
// Sensor-Modul: AO → A0, LED mit Vorwiderstand an Pin 9 (PWM)
//
// Tipp: Klicke während der Simulation auf den Sensor, um die
// Beleuchtungsstärke zu verändern.

const int SENSOR = A0;
const int LED = 9;

void setup() {
  Serial.begin(9600);
  pinMode(LED, OUTPUT);
  Serial.println("Rohwert;Helligkeit in %;LED (0-255)");
}

void loop() {
  int rohwert = analogRead(SENSOR);                  // 0 bis 1023
  int prozent = map(rohwert, 0, 1023, 0, 100);
  int led = map(rohwert, 0, 1023, 255, 0);           // je dunkler, desto heller die LED
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

  // ── Halbleiter, Kondensator und Schwingungen ─────────────────────────────
  {
    id: 'schule-gleichrichter',
    base: 'an-half-wave-rectifier',
    topic: 'halbleiter',
    title: 'Die Diode als Gleichrichter',
    description:
      'Eine Diode lässt von einer 50-Hz-Wechselspannung nur die positiven Halbwellen durch. Lernziele: Durchlass- und Sperrrichtung, Einweggleichrichtung. Mit dem Oszilloskop Ein- und Ausgang vergleichen.',
    difficulty: 'intermediate',
    code: ANALOG_ONLY,
  },
  {
    id: 'schule-transistor',
    base: 'npn-led-switch',
    topic: 'halbleiter',
    title: 'Der Transistor als Schalter',
    description:
      'Ein kleiner Basisstrom vom Arduino schaltet über einen NPN-Transistor den größeren Strom durch die LED. Lernziele: Basis, Kollektor, Emitter; Stromverstärkung; Transistor als elektronischer Schalter.',
    difficulty: 'intermediate',
    code: `// Der Transistor als Schalter
// Pin 9 → 1 kΩ → Basis des NPN-Transistors 2N2222
// Kollektorkreis: 5 V → 220 Ω → LED → Kollektor; Emitter → GND
//
// Ein kleiner Basisstrom (ca. (5 V − 0,7 V) / 1 kΩ ≈ 4 mA) steuert
// einen deutlich größeren Kollektorstrom durch die LED.

const int BASIS = 9;

void setup() {
  pinMode(BASIS, OUTPUT);
}

void loop() {
  digitalWrite(BASIS, HIGH);   // Basisstrom fließt → Transistor leitet
  delay(1000);
  digitalWrite(BASIS, LOW);    // kein Basisstrom → Transistor sperrt
  delay(1000);
}

// Aufgabe: Fahre mit der Maus über die Leitungen, um die Spannungen
// zu sehen. Wie groß ist U_BE, wenn der Transistor leitet?
`,
  },
  {
    id: 'schule-kondensator',
    base: 'capacitor-charge-curve',
    topic: 'halbleiter',
    title: 'Aufladen eines Kondensators',
    description:
      'Ein Kondensator (100 µF) wird über einen Widerstand (10 kΩ) geladen; der Arduino nimmt die Ladekurve auf. Lernziele: Zeitkonstante τ = R · C, exponentieller Verlauf, Auswertung in der Tabellenkalkulation.',
    difficulty: 'intermediate',
    code: `// Aufladen eines Kondensators
// Pin 8 → 10 kΩ → A0 → 100 µF → GND
// Zeitkonstante: τ = R · C = 10 000 Ω · 0,0001 F = 1 s
//
// Theorie: U_C(t) = U0 · (1 − e^(−t/τ))
// Nach t = τ ist der Kondensator auf ca. 63 % von U0 geladen.
//
// Ausgabe als Tabelle (Semikolon, Dezimalkomma) für Excel/LibreOffice.

const unsigned long DAUER_MS = 6000;   // 6 τ messen
unsigned long start;

void druckeKomma(float wert, int stellen) {
  String text = String(wert, stellen);
  text.replace('.', ',');
  Serial.print(text);
}

void setup() {
  Serial.begin(9600);
  pinMode(8, OUTPUT);
  digitalWrite(8, LOW);          // erst entladen
  delay(3000);
  Serial.println("t in s;U_C in V");
  start = millis();
  digitalWrite(8, HIGH);         // Ladevorgang starten
}

void loop() {
  unsigned long t = millis() - start;
  if (t > DAUER_MS) return;      // Messung beendet

  float u = analogRead(A0) * 5.0 / 1023.0;
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
  {
    id: 'schule-tiefpass',
    base: 'an-rc-low-pass',
    topic: 'halbleiter',
    title: 'RC-Tiefpass',
    description:
      'Ein Sinussignal läuft durch ein RC-Glied (R = 1,6 kΩ, C = 100 nF). Bei der Grenzfrequenz von etwa 1 kHz sinkt die Ausgangsspannung auf ca. 71 %. Lernziele: frequenzabhängiger Widerstand des Kondensators, Grenzfrequenz f = 1 / (2π · R · C).',
    difficulty: 'advanced',
    code: ANALOG_ONLY,
  },
  {
    id: 'schule-schwingkreis',
    base: 'an-rlc-series-resonance',
    topic: 'halbleiter',
    title: 'Elektrischer Schwingkreis (Resonanz)',
    description:
      'Reihenschwingkreis aus Spule (1 mH), Kondensator (1 µF) und Widerstand. Bei der Resonanzfrequenz f0 = 1 / (2π · √(L · C)) ≈ 5 kHz wird die Kondensatorspannung maximal. Lernziele: elektromagnetische Schwingungen, Thomsonsche Schwingungsgleichung, Resonanz.',
    difficulty: 'advanced',
    code: ANALOG_ONLY,
  },

  // ── Logikgatter und Rechnen mit Bits ─────────────────────────────────────
  {
    id: 'schule-und-gatter',
    base: 'digital-and-two-switches',
    topic: 'logik',
    title: 'UND-Verknüpfung',
    description:
      'Die LED leuchtet nur, wenn beide Schalter eingeschaltet sind. Lernziele: logisches UND, Wahrheitstabelle, Schaltzeichen.',
    difficulty: 'beginner',
    code: LOGIC_ONLY,
  },
  {
    id: 'schule-halbaddierer',
    base: 'digital-half-adder',
    topic: 'logik',
    title: 'Halbaddierer – Computer rechnen mit Gattern',
    description:
      'Ein XOR-Gatter bildet die Summe, ein UND-Gatter den Übertrag zweier Bits. Lernziele: binäre Addition, Wahrheitstabelle, wie ein Rechenwerk aufgebaut ist.',
    difficulty: 'intermediate',
    code: LOGIC_ONLY,
  },
  {
    id: 'schule-volladdierer',
    base: 'digital-full-adder',
    topic: 'logik',
    title: 'Volladdierer',
    description:
      'Zwei Halbaddierer und ein ODER-Gatter addieren zwei Bits und einen Übertrag. Mehrere Volladdierer hintereinander ergeben ein Addierwerk für ganze Zahlen. Lernziele: Übertrag, Verkettung, Rechenwerk.',
    difficulty: 'advanced',
    code: LOGIC_ONLY,
  },
];

/**
 * Materialise the school collection from the gallery examples. Entries
 * whose base example is missing (e.g. removed upstream) are skipped rather
 * than shipped broken.
 */
export function buildSchoolExamples(base: ExampleProject[]): ExampleProject[] {
  const byId = new Map(base.map((e) => [e.id, e]));
  const out: ExampleProject[] = [];
  for (const entry of ENTRIES) {
    const src = byId.get(entry.base);
    if (!src) continue;
    const built: ExampleProject = {
      ...src,
      id: entry.id,
      title: entry.title,
      description: entry.description,
      difficulty: entry.difficulty,
      code: entry.code ?? src.code,
      // Deep copies: the canvas loader may mutate positions in place.
      components: src.components.map((c) => ({ ...c, properties: { ...c.properties } })),
      wires: src.wires.map((w) => ({ ...w, start: { ...w.start }, end: { ...w.end } })),
      // Same circuit → same screenshot; the id-based thumb lookup would miss.
      thumbnail: src.thumbnail ?? `/examples-thumbs/${src.id}.webp`,
      tags: ['schule', entry.topic, ...(src.tags ?? [])],
      schoolTopic: entry.topic,
    };
    // The school collection runs on an ESP32; the Uno sketch above stays as the
    // fallback for circuits that have no ESP32 variant (pure analog/logic ones).
    const esp = ESP_VARIANTS[entry.id];
    out.push(esp ? toEsp32(built, esp) : built);
  }
  return out;
}
