#include <ArduinoBLE.h>
#include <Knock_me_out_inferencing.h>
#include "LSM6DS3.h"
#include <Wire.h>

/* ================== BLE ================== */

#define DEVICE_NAME "Knock2Drink"

BLEService knockService("12345678-1234-1234-1234-1234567890ab");

BLEStringCharacteristic knockCharacteristic(
  "abcdefab-1234-5678-1234-abcdefabcdef",
  BLERead | BLENotify,
  32
);

/* ================== RGB LED PINS ================== */

#define LED_RED LEDR
#define LED_GREEN LEDG
#define LED_BLUE LEDB

/* ================== LIGHTS ================== */

enum LightMode {
  LIGHT_OFF,
  LIGHT_RED,
  LIGHT_GREEN,
  LIGHT_BLUE,
  LIGHT_YELLOW,
  LIGHT_CYAN,
  LIGHT_MAGENTA,
  LIGHT_WHITE
};

void set_light(LightMode mode) {
  // Your wiring:
  // HIGH = ON
  // LOW  = OFF

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

    case LIGHT_CYAN:
      g = HIGH;
      b = HIGH;
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

    case LIGHT_OFF:
    default:
      break;
  }

  digitalWrite(LED_RED, r);
  digitalWrite(LED_GREEN, g);
  digitalWrite(LED_BLUE, b);
}

/* ================== MODES ================== */

enum Mode {
  MODE_SLEEP,
  MODE_SCANNING
};

Mode current_mode = MODE_SLEEP;

/* ================== TIMING ================== */

#define SCAN_DURATION_MS 15000
#define KNOCK_TIMEOUT_MS 1500
#define TARGET_KNOCKS 3
#define DEBOUNCE_MS 150

unsigned long scan_start_time = 0;
unsigned long last_knock_time = 0;

/* ================== IMU ================== */

LSM6DS3 imu(I2C_MODE, 0x6A);

/* ================== EDGE IMPULSE CONFIG ================== */

#define SAMPLE_INTERVAL_MS EI_CLASSIFIER_INTERVAL_MS
#define CONFIDENCE_THRESHOLD 0.90f

static float buffer[EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE];
static size_t buf_ix = 0;

static bool debug_nn = false;

/* ================== STATE ================== */

int knock_count = 0;

/* ================== BLE SEND ================== */

void send_ble_message(const char *msg) {
  knockCharacteristic.writeValue(msg);

  Serial.print("BLE SENT: ");
  Serial.println(msg);

  BLE.poll();
  delay(10);
}

void send_knock_count(int count) {
  String msg = "KNOCK:";
  msg += count;

  knockCharacteristic.writeValue(msg);

  Serial.print("BLE SENT: ");
  Serial.println(msg);

  BLE.poll();
  delay(10);
}

/* ================== SIMPLE WAKE DETECTION ================== */

bool simple_motion_detect(float x, float y, float z) {
  static float prev_mag = 0.0f;

  float mag = sqrt(x * x + y * y + z * z);
  float delta = abs(mag - prev_mag);

  prev_mag = mag;

  return delta > 20.0f;
}

/* ================== BLE SETUP ================== */

void setup_ble() {
  if (!BLE.begin()) {
    Serial.println("BLE init failed");

    set_light(LIGHT_RED);

    while (1);
  }

  BLE.setLocalName(DEVICE_NAME);
  BLE.setDeviceName(DEVICE_NAME);

  BLE.setAdvertisedService(knockService);

  knockService.addCharacteristic(knockCharacteristic);

  BLE.addService(knockService);

  knockCharacteristic.writeValue("READY");

  BLE.advertise();

  Serial.println("BLE advertising started");
}

/* ================== IMU SETUP ================== */

void setup_imu() {
  Wire.begin();

  if (imu.begin() != 0) {
    Serial.println("IMU ERROR");

    set_light(LIGHT_RED);

    while (1);
  }

  Serial.println("IMU OK");
}


/* ================== SAMPLE COLLECTION ================== */

bool collect_samples() {
  buf_ix = 0;

  while (buf_ix < EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE) {
    BLE.poll();

    buffer[buf_ix++] = imu.readFloatGyroX();
    buffer[buf_ix++] = imu.readFloatGyroY();
    buffer[buf_ix++] = imu.readFloatGyroZ();

    delay(SAMPLE_INTERVAL_MS);
  }

  return true;
}

/* ================== INFERENCE ================== */

bool run_inference() {
  signal_t signal;

  int err = numpy::signal_from_buffer(
    buffer,
    EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE,
    &signal
  );

  if (err != 0) {
    Serial.println("Signal error");
    return false;
  }

  ei_impulse_result_t result = { 0 };

  err = run_classifier(&signal, &result, debug_nn);

  if (err != EI_IMPULSE_OK) {
    Serial.println("Classifier error");
    return false;
  }

  float knock_score = 0.0f;

  for (size_t i = 0; i < EI_CLASSIFIER_LABEL_COUNT; i++) {
    Serial.print(result.classification[i].label);
    Serial.print(": ");
    Serial.println(result.classification[i].value);

    if (strcmp(result.classification[i].label, "knock") == 0) {
      knock_score = result.classification[i].value;
    }
  }

  Serial.println();

  return knock_score >= CONFIDENCE_THRESHOLD;
}

/* ================== KNOCK HANDLING ================== */

void handle_knock(bool detected) {
  static unsigned long last_detection_time = 0;

  unsigned long now = millis();

  if (detected && (now - last_detection_time > DEBOUNCE_MS)) {
    last_detection_time = now;

    if (now - last_knock_time < KNOCK_TIMEOUT_MS) {
      knock_count++;
    } else {
      knock_count = 1;
    }

    last_knock_time = now;

    Serial.print("Knock detected! Count: ");
    Serial.println(knock_count);

    send_knock_count(knock_count);

    set_light(LIGHT_MAGENTA);
    delay(80);
    set_light(LIGHT_YELLOW);
  }

  if (
    knock_count >= TARGET_KNOCKS &&
    (now - last_knock_time > KNOCK_TIMEOUT_MS)
  ) {
    Serial.print("FINAL KNOCK COUNT: ");
    Serial.println(knock_count);

    send_ble_message("KNOCK_PATTERN_OK");

    set_light(LIGHT_WHITE);
    delay(1000);

    knock_count = 0;
    last_knock_time = 0;
    scan_start_time = 0;

    current_mode = MODE_SLEEP;

    set_light(LIGHT_GREEN);
  }

  if (
    knock_count > 0 &&
    knock_count < TARGET_KNOCKS &&
    (now - last_knock_time > KNOCK_TIMEOUT_MS)
  ) {
    Serial.println("Knock sequence timeout");

    knock_count = 0;
    last_knock_time = 0;
  }
}

/* ================== SETUP ================== */

void setup() {
  Serial.begin(115200);

  delay(2000);

  pinMode(LED_RED, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_BLUE, OUTPUT);

  set_light(LIGHT_BLUE);

  Serial.println();
  Serial.println("Knock2Drink BLE boot");

  setup_ble();
  setup_imu();

  if (EI_CLASSIFIER_RAW_SAMPLES_PER_FRAME != 3) {
    Serial.println("EI CONFIG ERROR");

    set_light(LIGHT_RED);

    while (1);
  }

  current_mode = MODE_SLEEP;

  send_ble_message("DEVICE_READY");

  Serial.println("SYSTEM READY");
}

/* ================== LOOP ================== */

void loop() {
  BLE.poll();

  BLEDevice central = BLE.central();

  if (!central) {
    set_light(LIGHT_BLUE);
    return;
  }

  Serial.print("Connected to: ");
  Serial.println(central.address());

  set_light(LIGHT_GREEN);

  send_ble_message("PHONE_CONNECTED");

  while (central.connected()) {
    BLE.poll();

    float x = imu.readFloatGyroX();
    float y = imu.readFloatGyroY();
    float z = imu.readFloatGyroZ();

    if (current_mode == MODE_SLEEP) {
      if (simple_motion_detect(x, y, z)) {
        current_mode = MODE_SCANNING;

        scan_start_time = millis();
        knock_count = 0;
        last_knock_time = 0;

        set_light(LIGHT_YELLOW);

        send_ble_message("SCANNING_START");

        Serial.println("Wake detected");
      }
    }

    if (current_mode == MODE_SCANNING) {
      if (millis() - scan_start_time > SCAN_DURATION_MS) {
        current_mode = MODE_SLEEP;

        knock_count = 0;
        last_knock_time = 0;
        scan_start_time = 0;

        set_light(LIGHT_GREEN);

        send_ble_message("SCANNING_STOP");

        Serial.println("Scan timeout");

        continue;
      }

      collect_samples();

      bool knock_detected = run_inference();

      handle_knock(knock_detected);
    }
  }

  current_mode = MODE_SLEEP;
  knock_count = 0;
  last_knock_time = 0;
  scan_start_time = 0;

  set_light(LIGHT_BLUE);

  Serial.println("Central disconnected");
}