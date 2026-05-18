#include <Wire.h>
#include "LSM6DS3.h"

LSM6DS3 imu(I2C_MODE, 0x6A);

void setup() {
  Serial.begin(115200);
  delay(2000);

  Serial.println("Starting...");

  Wire.begin();

  if (imu.begin() != 0) {
    Serial.println("IMU init failed!");
    while (1);
  }

  Serial.println("IMU OK");
}

void loop() {
  float x = imu.readFloatGyroY();
  float y = imu.readFloatGyroY();
  float z = imu.readFloatGyroZ();

  Serial.print(x);
  Serial.print(",");
  Serial.print(y);
  Serial.print(",");
  Serial.println(z);

  delay(1);
}