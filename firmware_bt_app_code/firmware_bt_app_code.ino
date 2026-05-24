#include <ArduinoBLE.h>

#include <Knock_me_out_inferencing.h>

#include "LSM6DS3.h"

#include <Wire.h>

/* ================= BLE ================= */

#define DEVICE_ID "T1"

BLEService knockService(
  "12345678-1234-1234-1234-1234567890ab");

BLECharacteristic knockCharacteristic(
  "abcdefab-1234-5678-1234-abcdefabcdef",
  BLENotify,
  20);

/* ================= LED ================= */

#define LED_RED LEDR
#define LED_GREEN LEDG
#define LED_BLUE LEDB

enum LightMode {
  LIGHT_RED,
  LIGHT_GREEN,
  LIGHT_BLUE,
  LIGHT_YELLOW,
  LIGHT_MAGENTA,
  LIGHT_WHITE,
  LIGHT_OFF
};

void set_light(LightMode mode) {

  bool r = LOW;
  bool g = LOW;
  bool b = LOW;

  switch (mode) {

    case LIGHT_RED:
      r = HIGH;
      break;

    case LIGHT_GREEN:
      g = HIGH;
      break;

    case LIGHT_BLUE:
      b = HIGH;
      break;

    case LIGHT_YELLOW:
      r = HIGH;
      g = HIGH;
      break;

    case LIGHT_MAGENTA:
      r = HIGH;
      b = HIGH;
      break;

    case LIGHT_WHITE:
      r = HIGH;
      g = HIGH;
      b = HIGH;
      break;

    default:
      break;
  }

  digitalWrite(LED_RED, r);
  digitalWrite(LED_GREEN, g);
  digitalWrite(LED_BLUE, b);
}

/* ================= IMU ================= */

LSM6DS3 imu(I2C_MODE, 0x6A);

/* ================= CONFIG ================= */

#define CONFIDENCE_THRESHOLD 0.90f
#define SCAN_DURATION_MS 15000
#define KNOCK_TIMEOUT_MS 1500
#define DEBOUNCE_MS 150
#define MAX_KNOCKS 6
#define TARGET_KNOCKS 3

/* ================= STATE ================= */

enum Mode {
  MODE_SLEEP,
  MODE_SCANNING
};

Mode current_mode = MODE_SLEEP;
unsigned long scan_start_time = 0;
unsigned long last_knock_time = 0;
unsigned long last_detection_time = 0;
int knock_count = 0;

/* ================= EI ================= */

static float features[EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE];
static size_t feature_ix = 0;

/* ================= BLE SEND ================= */

void send_ble(const char *msg) {

  Serial.print("BLE TX -> ");
  Serial.println(msg);

  bool success = knockCharacteristic.writeValue(
    (const uint8_t *)msg,
    strlen(msg)
  );

  if (!success) {
    Serial.println("BLE SEND FAILED");
  }
}
/* ================= MOTION ================= */

bool simple_motion_detect(
  float x,
  float y,
  float z) {

  static float prev_mag = 0;
  float mag = sqrt(x * x + y * y + z * z);
  float delta = abs(mag - prev_mag);

  prev_mag = mag;

  return (delta > 0.3f);
}

/* ================= INFERENCE ================= */

bool run_inference_fast() {

  signal_t signal;

  int err = numpy::signal_from_buffer(
    features,
    EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE,
    &signal);

  if (err != 0) {
    return false;
  }

  ei_impulse_result_t result = { 0 };

  err = run_classifier(
    &signal,
    &result,
    false);

  if (err != EI_IMPULSE_OK) {
    return false;
  }

  for (
    size_t i = 0;
    i < EI_CLASSIFIER_LABEL_COUNT;
    i++) {

    if (
      strcmp(
        result.classification[i].label,
        "knock")
      == 0) {

      return (
        result.classification[i].value > CONFIDENCE_THRESHOLD);
    }
  }

  return false;
}

/* ================= KNOCK HANDLING ================= */

void handle_knock(bool detected) {

  unsigned long now = millis();

  /* ================= NEW KNOCK ================= */

  if (
    detected &&
    (now - last_detection_time > DEBOUNCE_MS)
  ) {

    last_detection_time = now;

    /* ---- continue sequence ---- */

    if (
      now - last_knock_time <
      KNOCK_TIMEOUT_MS
    ) {

      knock_count++;

    } else {

      /* ---- new sequence ---- */

      knock_count = 1;
    }

    last_knock_time = now;

    set_light(LIGHT_MAGENTA);

    Serial.print("KNOCK COUNT -> ");
    Serial.println(knock_count);

    /* ---- max knocks protection ---- */

    if (knock_count > MAX_KNOCKS) {

      Serial.println("TOO MANY KNOCKS");

      knock_count = 0;

      current_mode = MODE_SLEEP;

      set_light(LIGHT_RED);

      send_ble("ERR");

      return;
    }
  }

  /* ================= SEQUENCE FINISHED ================= */

  if (
    knock_count >= TARGET_KNOCKS &&
    knock_count <= MAX_KNOCKS &&
    (now - last_knock_time >
     KNOCK_TIMEOUT_MS)
  ) {

    char msg[20];

    snprintf(
      msg,
      sizeof(msg),
      "%s|OK:%d",
      DEVICE_ID,
      knock_count
    );

    Serial.print("FINAL -> ");
    Serial.println(msg);

    send_ble(msg);

    knock_count = 0;

    current_mode = MODE_SLEEP;

    set_light(LIGHT_GREEN);
  }

  /* ================= SCAN TIMEOUT ================= */

  if (
    current_mode == MODE_SCANNING &&
    (now - scan_start_time >
     SCAN_DURATION_MS)
  ) {

    Serial.println("SCAN TIMEOUT");

    current_mode = MODE_SLEEP;

    knock_count = 0;

    send_ble("Q");

    set_light(LIGHT_BLUE);
  }
}


/* ================= SETUP ================= */

void setup() {

  Serial.begin(115200);

  pinMode(LED_RED, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_BLUE, OUTPUT);

  set_light(LIGHT_BLUE);

  Wire.begin();

  if (imu.begin() != 0) {

    set_light(LIGHT_RED);

    while (1)
      ;
  }

  if (!BLE.begin()) {

    set_light(LIGHT_RED);

    while (1)
      ;
  }

  BLE.setLocalName("Knock2Drink");

  BLE.setAdvertisedService(knockService);

  knockService.addCharacteristic(
    knockCharacteristic);

  BLE.addService(knockService);

  BLE.advertise();

  set_light(LIGHT_GREEN);
}

/* ================= LOOP ================= */

void loop() {

  BLE.poll();

  float x = imu.readFloatGyroX();
  float y = imu.readFloatGyroY();
  float z = imu.readFloatGyroZ();
  if (current_mode == MODE_SLEEP) {

    if (
      simple_motion_detect(x, y, z)) {

      current_mode = MODE_SCANNING;

      scan_start_time = millis();

      knock_count = 0;

      feature_ix = 0;

      send_ble("S");

      set_light(LIGHT_YELLOW);
    }

    return;
  }

  features[feature_ix++] = x;
  features[feature_ix++] = y;
  features[feature_ix++] = z;

  if (
    feature_ix >= EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE) {

    feature_ix = 0;

    bool knock =
      run_inference_fast();

    handle_knock(knock);
  }
}
