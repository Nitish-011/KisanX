from pathlib import Path
from collections import Counter
import shutil

# ============================================================
# KISANX COTTON - CLEAN SEGMENTATION DATASET
# ORIGINAL DATASET IS NEVER MODIFIED
# ============================================================

SRC = Path(r"D:\KisanX\frontend\ml\cotton\data\dataset")
DST = Path(r"D:\KisanX\frontend\ml\cotton\data\cotton_seg_clean")

CLASS_NAMES = [
    "Aphids",
    "Army worm",
    "Bacterial blight",
    "Fuserium wilt",
    "Healthy",
    "Leaf curl",
]

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

if DST.exists():
    print(f"Removing previous clean dataset:\n{DST}")
    shutil.rmtree(DST)

DST.mkdir(parents=True)

stats = {}

for split in ["train", "valid", "test"]:

    src_images = SRC / split / "images"
    src_labels = SRC / split / "labels"

    dst_images = DST / split / "images"
    dst_labels = DST / split / "labels"

    dst_images.mkdir(parents=True)
    dst_labels.mkdir(parents=True)

    counts = Counter()
    included = 0
    excluded_mixed = 0
    excluded_detection = 0
    excluded_empty = 0
    excluded_bad = 0

    images = [
        p for p in src_images.rglob("*")
        if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
    ]

    for image in images:

        matches = list(
            src_labels.rglob(
                image.with_suffix(".txt").name
            )
        )

        if not matches:
            excluded_bad += 1
            continue

        label = matches[0]

        try:
            lines = [
                x.strip()
                for x in label.read_text(
                    encoding="utf-8",
                    errors="ignore"
                ).splitlines()
                if x.strip()
            ]
        except Exception:
            excluded_bad += 1
            continue

        if not lines:
            excluded_empty += 1
            continue

        formats = []

        valid = True

        for line in lines:

            parts = line.split()

            # Detection = class + 4 coordinates
            if len(parts) == 5:
                formats.append("detection")

            # Segmentation = class + x/y polygon points
            elif len(parts) >= 7 and (len(parts) - 1) % 2 == 0:
                formats.append("segmentation")

            else:
                valid = False
                break

        if not valid:
            excluded_bad += 1
            continue

        # ----------------------------------------------------
        # Only accept files where EVERY row is segmentation
        # ----------------------------------------------------

        if all(x == "segmentation" for x in formats):

            try:
                class_ids = set()

                for line in lines:

                    parts = line.split()
                    class_id = int(float(parts[0]))

                    if not 0 <= class_id < len(CLASS_NAMES):
                        valid = False
                        break

                    coords = [
                        float(x)
                        for x in parts[1:]
                    ]

                    if len(coords) < 6:
                        valid = False
                        break

                    if not all(
                        0 <= x <= 1
                        for x in coords
                    ):
                        valid = False
                        break

                    class_ids.add(class_id)

                if not valid:
                    excluded_bad += 1
                    continue

                # Preserve nested structure relative to images/
                relative = image.relative_to(src_images)

                out_image = dst_images / relative
                out_label = dst_labels / relative.with_suffix(".txt")

                out_image.parent.mkdir(
                    parents=True,
                    exist_ok=True
                )

                out_label.parent.mkdir(
                    parents=True,
                    exist_ok=True
                )

                shutil.copy2(
                    image,
                    out_image
                )

                shutil.copy2(
                    label,
                    out_label
                )

                included += 1

                for cid in class_ids:
                    counts[CLASS_NAMES[cid]] += 1

            except Exception:
                excluded_bad += 1

        elif all(x == "detection" for x in formats):

            excluded_detection += 1

        else:

            # Detection + segmentation in same label
            excluded_mixed += 1

    stats[split] = {
        "included": included,
        "mixed": excluded_mixed,
        "detection": excluded_detection,
        "empty": excluded_empty,
        "bad": excluded_bad,
        "counts": counts,
    }


# ============================================================
# Create clean data.yaml
# ============================================================

yaml_text = """train: ../cotton_seg_clean/train/images
val: ../cotton_seg_clean/valid/images
test: ../cotton_seg_clean/test/images
nc: 6
names: ['Aphids', 'Army worm', 'Bacterial blight', 'Fuserium wilt', 'Healthy', 'Leaf curl']
"""

# data.yaml must live inside cotton_seg_clean
(DST / "data.yaml").write_text(
    yaml_text,
    encoding="utf-8"
)


# ============================================================
# REPORT
# ============================================================

print("\n")
print("=" * 75)
print("CLEAN SEGMENTATION DATASET CREATED")
print("=" * 75)

for split in ["train", "valid", "test"]:

    s = stats[split]

    print(f"\n{split.upper()}")
    print("-" * 75)

    print(f"Included segmentation images : {s['included']}")
    print(f"Excluded mixed annotations   : {s['mixed']}")
    print(f"Excluded detection-only      : {s['detection']}")
    print(f"Excluded empty labels        : {s['empty']}")
    print(f"Excluded bad labels          : {s['bad']}")

    print("\nClass images:")
    for name in CLASS_NAMES:
        print(
            f"  {name:<22} "
            f"{s['counts'][name]}"
        )

print("\n")
print("=" * 75)
print("OUTPUT")
print("=" * 75)

print(DST)
print("\nData YAML:")
print(DST / "data.yaml")

print("\nOriginal dataset was NOT modified.")
print("=" * 75)
