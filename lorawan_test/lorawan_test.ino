#include <Arduino.h>

void printResponse(uint32_t timeout = 2000) {

  uint32_t start = millis();

  while (millis() - start < timeout) {

    while (Serial1.available()) {
      Serial.write(Serial1.read());
    }
  }

  Serial.println();
}

void setup() {

  pinMode(5, OUTPUT);
  digitalWrite(5, HIGH);

  Serial.begin(115200);
  Serial1.begin(9600);

  delay(5000);

  Serial.println("START");

  Serial1.print("AT\r\n");
  printResponse();

  Serial1.print("AT+DR=EU868\r\n");
  printResponse();

  Serial1.print("AT+MODE=LWOTAA\r\n");
  printResponse();

  Serial1.print("AT+ID=AppEui,\"0000000000000001\"\r\n");
  printResponse();

  Serial1.print("AT+ID=DevEui,\"70B3D57ED00778B8\"\r\n");
  printResponse();

  Serial1.print("AT+KEY=APPKEY,\"3392A92DC5BE252A962A8C13EA93C175\"\r\n");
  printResponse();

  Serial1.print("AT+ADR=ON\r\n");
  printResponse();

  Serial1.print("AT+CLASS=A\r\n");
  printResponse();

  Serial.println("JOIN");

  Serial1.print("AT+JOIN\r\n");
}

void loop() {

  while (Serial1.available()) {
    Serial.write(Serial1.read());
  }
  Serial1.print("AT+MSG=\"HELLO\"\r\n");
}