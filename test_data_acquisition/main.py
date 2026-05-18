import random
from pathlib import Path
import time
import serial.tools.list_ports
import serial
import csv
import numpy as np
import matplotlib.pyplot as plt


class KnockRecorder:
    def __init__(self):
        self.measure_name = "knock"   # change to "background" when needed
        self.measuring_time = 1    # 350 ms window (good for knock)
        self.repeats = 100

        self.folder = Path("meritve")
        self.folder.mkdir(exist_ok=True)

        port = self.get_xiao()
        self.ser = serial.Serial(port, 115200, timeout=1)

    # -----------------------------
    # Device detection
    # -----------------------------
    def get_xiao(self):
        for port in serial.tools.list_ports.comports():
            if port.pid == 32837 and port.vid == 10374:
                return port.device
        raise ConnectionError("XIAO not found")

    def center_window(self, data, window_size_s=0.25):
        if len(data) == 0:
            return None

        t = data[:,0]
        mag = np.sqrt(data[:,1]**2 + data[:,2]**2 + data[:,3]**2)

        peak_idx = np.argmax(mag)
        peak_time = t[peak_idx]

        start_time = peak_time - window_size_s / 2
        end_time   = peak_time + window_size_s / 2

        # clip bounds
        start_time = max(start_time, t[0])
        end_time   = min(end_time, t[-1])

        mask = (t >= start_time) & (t <= end_time)
        window = data[mask]

        # normalize time to 0
        window[:,0] = window[:,0] - window[0,0]

        # ensure enough samples
        if len(window) < 10:
            return None

        return window
    # -----------------------------
    # Data acquisition
    # -----------------------------
    def read_data(self, duration):
        self.ser.reset_input_buffer()

        buffer = bytearray()
        start_time = time.perf_counter()

        while (time.perf_counter() - start_time) < duration:
            chunk = self.ser.read(self.ser.in_waiting or 1)
            buffer.extend(chunk)

        lines = buffer.split(b'\n')

        data = []
        for line in lines:
            try:
                decoded = line.decode().strip()
                parts = decoded.split(",")

                if len(parts) != 3:
                    continue

                t = time.perf_counter() - start_time
                x, y, z = map(float, parts)

                data.append([t, x, y, z])

            except:
                continue

        return np.array(data)

    # Knock detection (simple check)
    def detect_knock(self, data):
        if len(data) == 0:
            return False, 0

        # magnitude of acceleration
        mag = np.sqrt(data[:,1]**2 + data[:,2]**2 + data[:,3]**2)

        peak = np.max(mag)
        mean = np.mean(mag)
        std = np.std(mag)

        # heuristic thresholds (tune later!)
        is_knock = (peak > mean + 5 * std) and (peak > 15)

        return is_knock, peak

    # Save CSV
    def save_to_csv(self, data):
        filename = f"{self.measure_name}_{random.randint(1000,9999)}.csv"
        path = self.folder / filename

        with open(path, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["time", "x", "y", "z"])

            for row in data:
                writer.writerow(row)

        print(f"Saved: {path}")

    # -----------------------------
    # Optional visualization
    # -----------------------------
    def plot_sample(self, data):
        if len(data) == 0:
            return

        t = data[:,0]
        x = data[:,1]
        y = data[:,2]
        z = data[:,3]

        plt.figure()
        plt.plot(t, x, label="X")
        plt.plot(t, y, label="Y")
        plt.plot(t, z, label="Z")
        plt.title("Sample")
        plt.legend()
        plt.show()

    # -----------------------------
    # Main loop
    # -----------------------------
    def run(self):
        saved = 0
        while saved < self.repeats:
            print(f"\nMeasurement {saved}/{self.repeats}")

            if self.measure_name == "knock":
                print("Get ready...")
                time.sleep(1)
                print("KNOCK NOW!")
            else:
                print("Stay still (background)...")
                time.sleep(1)

            data = self.read_data(self.measuring_time)

            if len(data) < 10:
                print("Too little data, retrying...")
                continue

            is_knock, peak = self.detect_knock(data)
            print(f"Peak: {peak:.2f} | Knock detected: {is_knock}")

            # validation
            if self.measure_name == "knock" and not is_knock:
                print("❌ No knock detected → retry")
                continue

            if self.measure_name == "background" and is_knock:
                print("❌ Knock detected in background → retry")
                continue

            # ⭐ NEW: center window for knock only
            if self.measure_name == "knock":
                data_centered = self.center_window(data, window_size_s=0.25)
                if data_centered is None:
                    print("❌ Centering failed → retry")
                    continue
                data = data_centered

            self.save_to_csv(data)
            #self.plot_sample(data)
            saved += 1



if __name__ == "__main__":
    rec = KnockRecorder()
    rec.run()