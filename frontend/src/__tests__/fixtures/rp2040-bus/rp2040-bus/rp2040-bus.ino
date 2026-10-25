// Bus traffic for the logic-analyzer tests on the Pico: one SPI0 transaction
// (chip select on GP17) and one I2C0 write to 0x3C. Compiled for rp2040:rp2040:rpipico.
#include <SPI.h>
#include <Wire.h>

void setup() {
  pinMode(17, OUTPUT);
  digitalWrite(17, HIGH);
  SPI.begin();
  Wire.begin();

  digitalWrite(17, LOW);
  SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));
  SPI.transfer(0x9F);
  SPI.transfer(0xA5);
  SPI.endTransaction();
  digitalWrite(17, HIGH);

  Wire.beginTransmission(0x3C);
  Wire.write(0x00);
  Wire.write(0xAF);
  Wire.endTransmission();
  Serial1.begin(9600);
  Serial1.print("ok");
}

void loop() {}
