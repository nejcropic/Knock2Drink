from pathlib import Path

folder = Path("meritve")  # change if needed

for file in folder.glob("*.csv"):
    new_name = file.name.replace("_", ".")
    new_path = file.with_name(new_name)

    # avoid overwriting existing files
    if new_path.exists():
        print(f"Skipping (exists): {new_path}")
        continue

    file.rename(new_path)
    print(f"Renamed: {file.name} -> {new_name}")