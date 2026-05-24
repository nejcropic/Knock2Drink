#include <ArduinoBLE.h>
#include <Knock_me_out_inferencing.h>
#include "LSM6DS3.h"
#include <Wire.h>

/* ================= BLE ================= */

#define DEVICE_ID "T1"

String device_name = String("Knock2Drink_") + DEVICE_ID;

BLEService knockService(
  "12345678-1234-1234-1234-1234567890ab"
);

BLEStringCharacteristic knockCharacteristic(
  "abcdefab-1234-5678-1234-abcdefabcdef",
  BLERead | BLENotify,
  20
);

/* ================= LED ================= */

#define LED_RED LEDR
#define LED_GREEN LEDG
#define LED_BLUE LEDB

enum LightMode {
  LIGHT_OFF,
  LIGHT_RED,
  LIGHT_GREEN,
  LIGHT_BLUE,
  LIGHT_YELLOW,
  LIGHT_MAGENTA,
  LIGHT_WHITE
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

/* ================= TIMING ================= */

#define SAMPLE_RATE_HZ 100
#define SAMPLE_INTERVAL_US (1000000 / SAMPLE_RATE_HZ)

#define SCAN_DURATION_MS 15000
#define KNOCK_TIMEOUT_MS 1500
#define DEBOUNCE_MS 150

#define CONFIDENCE_THRESHOLD 0.90f
#define MIN_VALID_KNOCKS 3

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

static bool inference_ready = false;

/* ================= BLE QUEUE ================= */

String pending_ble_message = "";

bool ble_message_pending = false;

void queue_ble(const String &msg) {
  pending_ble_message = msg;

  ble_message_pending = true;
}

void process_ble_queue() {
  if (!ble_message_pending) {
    return;
  }

  knockCharacteristic.writeValue(pending_ble_message);

  ble_message_pending = false;
}

/* ================= MOTION ================= */

bool simple_motion_detect(
  float x,
  float y,
  float z
) {
  static float prev_mag = 0.0f;

  float mag = sqrt(x * x + y * y + z * z);

  float delta = abs(mag - prev_mag);

  prev_mag = mag;

  return delta > 20.0f;
}

/* ================= SAMPLE COLLECTION ================= */

void update_sampling() {
  static uint32_t last_sample_us = 0;

  uint32_t now = micros();

  if ((now - last_sample_us) < SAMPLE_INTERVAL_US) {
    return;
  }

  last_sample_us += SAMPLE_INTERVAL_US;

  float gx = imu.readFloatGyroX();
  float gy = imu.readFloatGyroY();
  float gz = imu.readFloatGyroZ();

  if (current_mode == MODE_SLEEP) {
    if (simple_motion_detect(gx, gy, gz)) {
      current_mode = MODE_SCANNING;

      scan_start_time = millis();

      knock_count = 0;

      set_light(LIGHT_YELLOW);

      queue_ble(
        String(DEVICE_ID) + "|S"
      );

      Serial.println("SCAN START");
    }

    return;
  }

  features[feature_ix++] = gx;
  features[feature_ix++] = gy;
  features[feature_ix++] = gz;

  if (
    feature_ix >=
    EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE
  ) {
    feature_ix = 0;

    inference_ready = true;
  }
}

/* ================= INFERENCE ================= */

bool run_inference_fast() {
  signal_t signal;

  int err = numpy::signal_from_buffer(
    features,
    EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE,
    &signal
  );

  if (err != 0) {
    return false;
  }

  ei_impulse_result_t result = { 0 };

  err = run_classifier(
    &signal,
    &result,
    false
  );

  if (err != EI_IMPULSE_OK) {
    return false;
  }

  for (
    size_t i = 0;
    i < EI_CLASSIFIER_LABEL_COUNT;
    i++
  ) {
    if (
      strcmp(
        result.classification[i].label,
        "knock"
      ) == 0 &&
      result.classification[i].value >=
        CONFIDENCE_THRESHOLD
    ) {
      return true;
    }
  }

  return false;
}

/* ================= KNOCK HANDLER ================= */

void handle_knock(bool detected) {
  unsigned long now = millis();

  if (
    detected &&
    (now - last_detection_time >
     DEBOUNCE_MS)
  ) {
    last_detection_time = now;

    if (
      now - last_knock_time <
      KNOCK_TIMEOUT_MS
    ) {
      knock_count++;
    } else {
      knock_count = 1;
    }

    last_knock_time = now;

    Serial.print("KNOCK ");
    Serial.println(knock_count);

    set_light(LIGHT_MAGENTA);

    if (knock_count >= MIN_VALID_KNOCKS) {
      queue_ble(
        String(DEVICE_ID) +
        "|K:" +
        String(knock_count)
      );
    }
  }

  if (
    knock_count >= MIN_VALID_KNOCKS &&
    (now - last_knock_time >
     KNOCK_TIMEOUT_MS)
  ) {
    queue_ble(
      String(DEVICE_ID) +
      "|PATTERN_OK:" +
      String(knock_count)
    );

    Serial.println("PATTERN OK");

    knock_count = 0;

    current_mode = MODE_SLEEP;

    set_light(LIGHT_WHITE);
  }

  if (
    current_mode == MODE_SCANNING &&
    (now - scan_start_time >
     SCAN_DURATION_MS)
  ) {
    current_mode = MODE_SLEEP;

    knock_count = 0;

    queue_ble(
      String(DEVICE_ID) + "|Q"
    );

    Serial.println("SCAN STOP");

    set_light(LIGHT_GREEN);
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

  BLE.setLocalName(
    device_name.c_str()
  );

  BLE.setAdvertisedService(
    knockService
  );

  knockService.addCharacteristic(
    knockCharacteristic
  );

  BLE.addService(knockService);

  BLE.advertise();

  Serial.println("READY");

  set_light(LIGHT_GREEN);
}

/* ================= LOOP ================= */

void loop() {
  BLE.poll();

  process_ble_queue();

  BLEDevice central = BLE.central();

  if (!central) {
    return;
  }

  while (central.connected()) {
    BLE.poll();

    process_ble_queue();

    update_sampling();

    if (inference_ready) {
      inference_ready = false;

      bool knock =
        run_inference_fast();

      handle_knock(knock);
    }
  }

  current_mode = MODE_SLEEP;

  knock_count = 0;

  feature_ix = 0;

  inference_ready = false;

  set_light(LIGHT_BLUE);

  Serial.println("DISCONNECTED");
}