#include <Knock_me_out_inferencing.h>
#include "LSM6DS3.h"
#include <Wire.h>

/* ================== MODES ================== */
enum Mode {
  MODE_SLEEP,
  MODE_SCANNING
};

Mode current_mode = MODE_SLEEP;

/* ================== TIMING ================== */
#define SCAN_DURATION_MS 15000
unsigned long scan_start_time = 0;

/* ================== IMU ================== */
LSM6DS3 imu(I2C_MODE, 0x6A);

/* ================== CONFIG ================== */
#define SAMPLE_INTERVAL_MS EI_CLASSIFIER_INTERVAL_MS
#define CONFIDENCE_THRESHOLD 0.9f

/* Knock logic */
#define KNOCK_TIMEOUT_MS 1500
#define TARGET_KNOCKS 3
#define DEBOUNCE_MS 150

/* ================== BUFFER ================== */
static float buffer[EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE];
static size_t buf_ix = 0;

/* ================== STATE ================== */
unsigned long last_knock_time = 0;
int knock_count = 0;

static bool debug_nn = false;

/* ================== SIMPLE WAKE DETECTION ================== */
bool simple_motion_detect(float x, float y, float z) {
  float mag = sqrt(x * x + y * y + z * z);
  return (mag > 2.5);  // 🔧 tune this threshold!
}

/* ================== SETUP ================== */
void setup() {
  pinMode(LED_BLUE, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);

  Serial.begin(115200);
  delay(2000);

  Serial.println("Knock detector (Edge Impulse)");

  Wire.begin();

  if (imu.begin() != 0) {
    Serial.println("IMU init failed!");
    while (1);
  }

  Serial.println("IMU OK");

  if (EI_CLASSIFIER_RAW_SAMPLES_PER_FRAME != 3) {
    Serial.println("ERR: Model expects 3 axes");
    while (1);
  }

  /* Start in sleep mode */
  current_mode = MODE_SLEEP;

  digitalWrite(LED_BLUE, LOW);   // sleep indicator
  digitalWrite(LED_RED, LOW);
  digitalWrite(LED_GREEN, LOW);
}

/* ================== BUFFER ================== */
void add_sample(float x, float y, float z) {
  buffer[buf_ix++] = x;
  buffer[buf_ix++] = y;
  buffer[buf_ix++] = z;

  if (buf_ix >= EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE) {
    buf_ix = 0;
  }
}

/* ================== INFERENCE ================== */
bool run_inference(float *data) {
  signal_t signal;
  int err = numpy::signal_from_buffer(
    data,
    EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE,
    &signal);

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

  float knock_score = 0;

  for (size_t i = 0; i < EI_CLASSIFIER_LABEL_COUNT; i++) {
    if (strcmp(result.classification[i].label, "knock") == 0) {
      knock_score = result.classification[i].value;
    }
  }

  Serial.print("Score: ");
  Serial.println(knock_score);

  return (knock_score > CONFIDENCE_THRESHOLD);
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

    if (knock_count >= TARGET_KNOCKS) {
      Serial.println(">>> 3 KNOCKS DETECTED! TRIGGER ACTION <<<");
      knock_count = 0;

      digitalWrite(LED_GREEN, HIGH);
      digitalWrite(LED_RED, LOW);
      
      scan_start_time = millis();
      delay(1000);
    }

    digitalWrite(LED_GREEN, LOW);
    digitalWrite(LED_RED, HIGH);
  }
}

/* ================== LOOP ================== */
void loop() {
  static unsigned long last_sample_time = 0;

  if (millis() - last_sample_time >= SAMPLE_INTERVAL_MS) {
    last_sample_time = millis();

    /* Read ACCEL */
    float x = imu.readFloatGyroX();
    float y = imu.readFloatGyroY();
    float z = imu.readFloatGyroZ();

    add_sample(x, y, z);

    /* ================== SLEEP MODE ================== */
    if (current_mode == MODE_SLEEP) {

      // Lightweight detection (NO ML)
      if (simple_motion_detect(x, y, z)) {

        Serial.println("Wake-up motion!");

        current_mode = MODE_SCANNING;
        scan_start_time = millis();
        knock_count = 0;
        buf_ix = 0;  

        digitalWrite(LED_BLUE, HIGH);   
        digitalWrite(LED_GREEN, LOW);
      }
    }

    /* ================== SCANNING MODE ================== */
    else if (current_mode == MODE_SCANNING) {

      if (buf_ix == 0) {
        bool knock = run_inference(buffer);
        handle_knock(knock);
      }

      // Timeout → go back to sleep
      if (millis() - scan_start_time > SCAN_DURATION_MS) {
        Serial.println("Scan timeout → sleep");

        current_mode = MODE_SLEEP;
        knock_count = 0;

        digitalWrite(LED_BLUE, LOW);  // sleep indicator
        digitalWrite(LED_GREEN, HIGH);
      }
    }
  }
}