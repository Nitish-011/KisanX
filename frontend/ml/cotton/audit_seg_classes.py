from pathlib import Path
from collections import Counter, defaultdict

ROOT = Path(r"D:\KisanX\frontend\ml\cotton\data\cotton_seg_clean")

CLASSES = [
    "Aphids",
    "Army worm",
    "Bacterial blight",
    "Fuserium wilt",
    "Healthy",
    "Leaf curl",
]

for split in ["train", "valid", "test"]:
    label_dir = ROOT / split / "labels"

    class_instances = Counter()
    class_images = Counter()
    area_sum = defaultdict(float)
    area_count = Counter()
    small_masks = Counter()

    files = list(label_dir.rglob("*.txt"))

    for f in files:
        seen = set()

        for line in f.read_text(errors="ignore").splitlines():
            p = line.split()

            if len(p) < 7:
                continue

            try:
                cls = int(float(p[0]))
                coords = list(map(float, p[1:]))

                if cls < 0 or cls >= len(CLASSES):
                    continue

                xs = coords[0::2]
                ys = coords[1::2]

                if len(xs) < 3:
                    continue

                # Bounding-box area from polygon
                width = max(xs) - min(xs)
                height = max(ys) - min(ys)
                area = width * height

                class_instances[cls] += 1
                area_sum[cls] += area
                area_count[cls] += 1

                if area < 0.01:
                    small_masks[cls] += 1

                seen.add(cls)

            except:
                pass

        for cls in seen:
            class_images[cls] += 1

    print("\n" + "=" * 70)
    print(split.upper())
    print("=" * 70)

    for cls, name in enumerate(CLASSES):
        n = class_instances[cls]

        avg = (
            area_sum[cls] / area_count[cls]
            if area_count[cls]
            else 0
        )

        small_pct = (
            100 * small_masks[cls] / n
            if n
            else 0
        )

        print(
            f"{name:<22} "
            f"images={class_images[cls]:<5} "
            f"instances={n:<5} "
            f"avg_box_area={avg:.4f} "
            f"<1%={small_pct:.1f}%"
        )