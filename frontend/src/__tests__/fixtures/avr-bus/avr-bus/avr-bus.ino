// Bus traffic for the logic-analyzer tests: one SPI transaction (chip select
// on D10) and one I²C write to 0x3C. Compiled for arduino:avr:uno.
#include <SPI.h>
#include <Wire.h>

void setup() {
  pinMode(10, OUTPUT);
  digitalWrite(10, HIGH);
  SPI.begin();
  Wire.begin();

  digitalWrite(10, LOW);
  SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));
  SPI.transfer(0x9F);
  SPI.transfer(0xA5);
  SPI.endTransaction();
  digitalWrite(10, HIGH);

  Wire.beginTransmission(0x3C);
  Wire.write(0x00);
  Wire.write(0xAF);
  Wire.endTransmission();
  Serial.begin(9600);
  Serial.print("ok");
}

void loop() {}
