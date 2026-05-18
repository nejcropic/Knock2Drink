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

/* ================== LORA ================== */

void read_lora_response() {

  while (Serial1.available()) {

    char c = Serial1.read();

    Serial.write(c);
  }
}

void send_at_command(const char *cmd, int wait_ms = 1000) {

  Serial.print("CMD: ");
  Serial.println(cmd);

  Serial1.print(cmd);
  Serial1.print("\r\n");

  delay(wait_ms);

  read_lora_response();
}

void send_lora_message(const char *msg) {

  Serial.print("Sending: ");
  Serial.println(msg);

  Serial1.print("AT+MSG=\"");
  Serial1.print(msg);
  Serial1.print("\"\r\n");

  delay(3000);

  read_lora_response();
}

void set_light(const char *colour) {
  if (colour == "blue") {
    digitalWrite(LED_BLUE, HIGH);
    digitalWrite(LED_RED, LOW);
    digitalWrite(LED_GREEN, LOW);
  }
  else if (colour == "green") {
    digitalWrite(LED_BLUE, LOW);
    digitalWrite(LED_RED, LOW);
    digitalWrite(LED_GREEN, HIGH);
  }
  else {
    digitalWrite(LED_BLUE, LOW);
    digitalWrite(LED_RED, HIGH);
    digitalWrite(LED_GREEN, LOW);
  }
}

/* ================== SIMPLE WAKE DETECTION ================== */

bool simple_motion_detect(float x, float y, float z) {

  static float prev_mag = 0;

  float mag = sqrt(x * x + y * y + z * z);
  float delta = abs(mag - prev_mag);

  prev_mag = mag;

  return (delta > 0.3);
}

/* ================== TTN JOIN ================== */

bool join_ttn() {

  bool joined = false;

  while (!joined) {

    Serial.println("Joining TTN...");

    Serial1.print("AT+JOIN\r\n");

    unsigned long start = millis();

    while (millis() - start < 15000) {

      while (Serial1.available()) {

        String line = Serial1.readStringUntil('\n');

        line.trim();

        if (line.length() > 0) {
          Serial.println(line);
        }

        if (line.indexOf("+JOIN: Network joined") >= 0 || line.indexOf("+JOIN: Joined already") >= 0) {

          joined = true;

          Serial.println("TTN JOIN SUCCESS");

          return true;
        }
      }
    }

    Serial.println("Join failed, retrying in 5s...");

    delay(5000);
  }

  return false;
}

/* ================== SETUP ================== */

void setup() {

  /* Turn ON LoRa modem */
  pinMode(5, OUTPUT);
  digitalWrite(5, HIGH);

  /* LEDs */
  pinMode(LED_BLUE, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  set_light("red");

  /* Serial */
  Serial.begin(115200);
  Serial1.begin(9600);

  delay(3000);    
  send_at_command("AT+RESET", 3000);

  Serial.println("BOOT");

  /* I2C */
  Wire.begin();

  /* IMU */
  if (imu.begin() != 0) {

    Serial.println("IMU ERROR");

    while (1)
      ;
  }

  Serial.println("IMU OK");

  /* Edge Impulse sanity check */
  if (EI_CLASSIFIER_RAW_SAMPLES_PER_FRAME != 3) {

    Serial.println("EI CONFIG ERROR");

    while (1)
      ;
  }

  /* ================== LORA CONFIG ================== */

  send_at_command("AT");

  send_at_command("AT+ID");

  send_at_command("AT+ID=AppEui,\"0000000000000001\"");

  send_at_command("AT+ID=DevEui,\"70B3D57ED00778B6\"");

  send_at_command("AT+KEY=AppKey,\"3662C3BD0542053FC85051962FFE4415\"");

  send_at_command("AT+MODE=LWOTAA");

  send_at_command("AT+ADR=OFF");

  send_at_command("AT+DR=DR0");

  /* ================== JOIN TTN ================== */

  join_ttn();

  /* Start in sleep mode */
  current_mode = MODE_SLEEP;

  Serial.println("SYSTEM READY");
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
    return false;
  }

  ei_impulse_result_t result = { 0 };

  err = run_classifier(&signal, &result, debug_nn);

  if (err != EI_IMPULSE_OK) {
    return false;
  }

  float knock_score = 0;

  for (size_t i = 0; i < EI_CLASSIFIER_LABEL_COUNT; i++) {

    if (strcmp(result.classification[i].label, "knock") == 0) {

      knock_score = result.classification[i].value;
    }
  }

  Serial.print("Knock score: ");
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

    digitalWrite(LED_RED, HIGH);

    if (knock_count >= TARGET_KNOCKS) {

      Serial.println("3 KNOCKS DETECTED");

      send_lora_message("KNOCK3");

      knock_count = 0;

      digitalWrite(LED_GREEN, HIGH);
      digitalWrite(LED_RED, LOW);

      scan_start_time = millis();
    }
  }
}

/* ================== LOOP ================== */

void loop() {

  static unsigned long last_sample_time = 0;

  if (millis() - last_sample_time >= SAMPLE_INTERVAL_MS) {

    last_sample_time = millis();

    /* Read gyro */
    float x = imu.readFloatGyroX();
    float y = imu.readFloatGyroY();
    float z = imu.readFloatGyroZ();

    add_sample(x, y, z);

    /* ================== SLEEP MODE ================== */

    if (current_mode == MODE_SLEEP) {

      if (simple_motion_detect(x, y, z)) {

        Serial.println("WAKE DETECTED");

        current_mode = MODE_SCANNING;

        scan_start_time = millis();

        knock_count = 0;

        buf_ix = 0;

        send_lora_message("SCANNING_START");

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

      /* Timeout -> sleep */

      if (millis() - scan_start_time > SCAN_DURATION_MS) {

        Serial.println("SCAN TIMEOUT");

        current_mode = MODE_SLEEP;

        knock_count = 0;

        send_lora_message("SCANNING_STOP");

        digitalWrite(LED_BLUE, LOW);
        digitalWrite(LED_GREEN, HIGH);
        digitalWrite(LED_RED, LOW);
      }
    }
  }
}