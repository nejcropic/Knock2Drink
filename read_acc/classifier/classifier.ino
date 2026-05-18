#include <Knock_me_out_inferencing.h>
#include "LSM6DS3.h"
#include <Wire.h>

/* IMU */
LSM6DS3 imu(I2C_MODE, 0x6A);    

/* Constants */
#define CONVERT_G_TO_MS2 9.80665f
#define MAX_ACCEPTED_RANGE 2.0f

/* Globals */
static bool debug_nn = false;
static float buffer[EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE];
static float inference_buffer[EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE];

/* Smooth */
ei_classifier_smooth_t smooth;

/* Utility */
float ei_get_sign(float number) {
    return (number >= 0.0) ? 1.0 : -1.0;
}

/* Setup */
void setup()
{
    Serial.begin(921600);
    delay(2000);

    Serial.println("Edge Impulse - XIAO nRF52840");

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

    ei_classifier_smooth_init(&smooth, 10, 7, 0.8, 0.3);
}

/* Loop */
void loop()
{
    /* Fill buffer */
    for (size_t ix = 0; ix < EI_CLASSIFIER_RAW_SAMPLE_COUNT; ix++) {

        float x = imu.readFloatAccelX();
        float y = imu.readFloatAccelY();
        float z = imu.readFloatAccelZ();

        /* Clamp */
        if (fabs(x) > MAX_ACCEPTED_RANGE) x = ei_get_sign(x) * MAX_ACCEPTED_RANGE;
        if (fabs(y) > MAX_ACCEPTED_RANGE) y = ei_get_sign(y) * MAX_ACCEPTED_RANGE;
        if (fabs(z) > MAX_ACCEPTED_RANGE) z = ei_get_sign(z) * MAX_ACCEPTED_RANGE;

        /* Convert to m/s^2 */
        x *= CONVERT_G_TO_MS2;
        y *= CONVERT_G_TO_MS2;
        z *= CONVERT_G_TO_MS2;

        /* Store */
        buffer[ix * 3 + 0] = x;
        buffer[ix * 3 + 1] = y;
        buffer[ix * 3 + 2] = z;

        delay(EI_CLASSIFIER_INTERVAL_MS);
    }

    /* Copy buffer */
    memcpy(inference_buffer, buffer, sizeof(buffer));

    /* Create signal */
    signal_t signal;
    int err = numpy::signal_from_buffer(
        inference_buffer,
        EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE,
        &signal
    );

    if (err != 0) {
        Serial.println("Signal error");
        return;
    }

    /* Run classifier */
    ei_impulse_result_t result = {0};
    err = run_classifier(&signal, &result, debug_nn);

    if (err != EI_IMPULSE_OK) {
        Serial.println("Classifier error");
        return;
    }

    /* Output */
    Serial.print("Prediction: ");

    const char *prediction = ei_classifier_smooth_update(&smooth, &result);
    Serial.print(prediction);

    Serial.print(" | ");

    for (size_t i = 0; i < EI_CLASSIFIER_LABEL_COUNT; i++) {
        Serial.print(result.classification[i].label);
        Serial.print(": ");
        Serial.print(result.classification[i].value, 3);
        Serial.print(" ");
    }

    Serial.println();
}