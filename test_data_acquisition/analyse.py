import numpy as np
import pandas as pd
from pathlib import Path

FOLDER = Path("meritve")

def analyze_file(path):
    df = pd.read_csv(path)

    if not all(col in df.columns for col in ["x","y","z"]):
        return None

    mag = np.sqrt(df["x"]**2 + df["y"]**2 + df["z"]**2)

    peak = np.max(mag)
    mean = np.mean(mag)
    std = np.std(mag)

    return {
        "file": path.name,
        "samples": len(df),
        "peak": peak,
        "mean": mean,
        "std": std,
        "peak/std": peak/std if std > 0 else 0
    }


def classify_sample(stats):
    # heuristic rules (based on your data)
    if stats["peak"] > stats["mean"] + 5 * stats["std"] and stats["peak"] > 10:
        return "knock"
    else:
        return "background"


def evaluate_dataset():
    results = []

    for file in FOLDER.glob("*.csv"):
        stats = analyze_file(file)
        if stats is None:
            continue

        predicted = classify_sample(stats)

        label = "knock" if "knock" in file.name else "background"

        ok = (predicted == label)

        stats["predicted"] = predicted
        stats["label"] = label
        stats["ok"] = ok

        results.append(stats)

    # print results
    good = 0
    bad = 0

    print("\n=== DATASET ANALYSIS ===\n")

    for r in results:
        status = "OK" if r["ok"] else "BAD"
        print(f"{r['file']:25} | {r['label']:10} | pred: {r['predicted']:10} | peak={r['peak']:.2f} | {status}")

        if r["ok"]:
            good += 1
        else:
            bad += 1

    print("\nSummary:")
    print(f"Good samples: {good}")
    print(f"Bad samples: {bad}")

    if bad > 0:
        print("⚠ You have mislabeled or weak samples")
    else:
        print("✅ Dataset looks consistent")

    return results


if __name__ == "__main__":
    evaluate_dataset()