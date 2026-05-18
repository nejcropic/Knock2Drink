#include <Wire.h>
#include "LSM6DS3.h"

LSM6DS3 imu(I2C_MODE, 0x6A);

void setup() {
  Serial.begin(115200);   
  Wire.begin();

  if (imu.begin() != 0) {
    while (1);
  }
}

void loop() {
  float x = imu.readFloatGyroX();
  float y = imu.readFloatGyroY();
  float z = imu.readFloatGyroZ();

  Serial.print(x);
  Serial.print(',');
  Serial.print(y);
  Serial.print(',');
  Serial.print(z);
  Serial.write('\n');   

}