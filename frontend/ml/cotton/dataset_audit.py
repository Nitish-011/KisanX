from pathlib import Path
from collections import Counter, defaultdict

# ============================================================
# KISANX COTTON DATASET AUDIT v4
# Handles YOLO DETECTION + YOLO SEGMENTATION
# ============================================================

DATASET = Path(
    r"D:\KisanX\frontend\ml\cotton\data\dataset"
)

CLASS_NAMES = [
    "Aphids",
    "Army worm",
    "Bacterial blight",
    "Fuserium wilt",
    "Healthy",
    "Leaf curl",
]

IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".bmp",
    ".webp",
}

SPLITS = [
    "train",
    "valid",
    "test",
]

print("=" * 75)
print("KISANX COTTON DATASET AUDIT v4")
print("YOLO DETECTION + SEGMENTATION")
print("=" * 75)


# ============================================================
# Find images
# ============================================================

def find_images(folder):

    if not folder.exists():
        return []

    return [
        p
        for p in folder.rglob("*")
        if p.is_file()
        and p.suffix.lower() in IMAGE_EXTENSIONS
    ]


# ============================================================
# Find matching label
# ============================================================

def find_label(image_path, split_dir):

    labels_dir = split_dir / "labels"

    if not labels_dir.exists():
        return None

    matches = list(
        labels_dir.rglob(
            image_path.with_suffix(".txt").name
        )
    )

    if matches:
        return matches[0]

    return None


# ============================================================
# Process label
# ============================================================

def process_label(
    label_path,
    class_instances,
    class_images,
    bbox_areas,
    formats,
    errors,
):

    try:

        lines = label_path.read_text(
            encoding="utf-8",
            errors="ignore"
        ).splitlines()

    except Exception as e:

        errors.append(
            (
                str(label_path),
                f"READ ERROR: {e}"
            )
        )

        return 0, set()

    lines = [
        line.strip()
        for line in lines
        if line.strip()
    ]

    if not lines:
        return 0, set()

    instance_count = 0
    image_classes = set()

    for line_number, line in enumerate(
        lines,
        start=1
    ):

        parts = line.split()

        # ====================================================
        # YOLO DETECTION
        # class x_center y_center width height
        # ====================================================

        if len(parts) == 5:

            try:

                class_id = int(float(parts[0]))

                x = float(parts[1])
                y = float(parts[2])
                w = float(parts[3])
                h = float(parts[4])

            except ValueError:

                errors.append(
                    (
                        str(label_path),
                        f"Line {line_number}: "
                        "invalid detection"
                    )
                )

                continue

            if not (
                0 <= class_id < len(CLASS_NAMES)
            ):

                errors.append(
                    (
                        str(label_path),
                        f"Line {line_number}: "
                        f"unknown class {class_id}"
                    )
                )

                continue

            if not (
                0 <= x <= 1
                and 0 <= y <= 1
                and 0 < w <= 1
                and 0 < h <= 1
            ):

                errors.append(
                    (
                        str(label_path),
                        f"Line {line_number}: "
                        "invalid bbox"
                    )
                )

                continue

            class_name = CLASS_NAMES[class_id]

            class_instances[class_name] += 1
            image_classes.add(class_name)

            bbox_areas[class_name].append(
                w * h
            )

            formats["detection"] += 1

            instance_count += 1

        # ====================================================
        # YOLO SEGMENTATION
        # class x1 y1 x2 y2 x3 y3 ...
        # ====================================================

        elif len(parts) >= 7:

            try:

                class_id = int(float(parts[0]))

                coordinates = [
                    float(x)
                    for x in parts[1:]
                ]

            except ValueError:

                errors.append(
                    (
                        str(label_path),
                        f"Line {line_number}: "
                        "invalid segmentation"
                    )
                )

                continue

            # Need pairs of x,y
            if len(coordinates) % 2 != 0:

                errors.append(
                    (
                        str(label_path),
                        f"Line {line_number}: "
                        "odd number of coordinates"
                    )
                )

                continue

            if not (
                0 <= class_id < len(CLASS_NAMES)
            ):

                errors.append(
                    (
                        str(label_path),
                        f"Line {line_number}: "
                        f"unknown class {class_id}"
                    )
                )

                continue

            points = [
                (
                    coordinates[i],
                    coordinates[i + 1]
                )
                for i in range(
                    0,
                    len(coordinates),
                    2
                )
            ]

            # Validate coordinates
            valid_points = all(
                0 <= x <= 1
                and 0 <= y <= 1
                for x, y in points
            )

            if not valid_points:

                errors.append(
                    (
                        str(label_path),
                        f"Line {line_number}: "
                        "coordinates outside 0-1"
                    )
                )

                continue

            if len(points) < 3:

                errors.append(
                    (
                        str(label_path),
                        f"Line {line_number}: "
                        "less than 3 polygon points"
                    )
                )

                continue

            class_name = CLASS_NAMES[class_id]

            class_instances[class_name] += 1
            image_classes.add(class_name)

            # ------------------------------------------------
            # Calculate bounding box from polygon
            # ------------------------------------------------

            xs = [
                p[0]
                for p in points
            ]

            ys = [
                p[1]
                for p in points
            ]

            width = max(xs) - min(xs)
            height = max(ys) - min(ys)

            area = width * height

            bbox_areas[class_name].append(
                area
            )

            formats["segmentation"] += 1

            instance_count += 1

        # ====================================================
        # UNKNOWN FORMAT
        # ====================================================

        else:

            errors.append(
                (
                    str(label_path),
                    f"Line {line_number}: "
                    f"unsupported format with "
                    f"{len(parts)} values"
                )
            )

    return instance_count, image_classes


# ============================================================
# Audit split
# ============================================================

def audit_split(split):

    split_dir = DATASET / split
    images_dir = split_dir / "images"

    print("\n")
    print("=" * 75)
    print(f"{split.upper()} DATASET")
    print("=" * 75)

    print(f"\nImages: {images_dir}")
    print(f"Labels: {split_dir / 'labels'}")

    images = find_images(images_dir)

    print(f"\nImages found: {len(images)}")

    class_instances = Counter()
    class_images = Counter()

    bbox_areas = defaultdict(list)

    formats = Counter()

    empty_labels = []
    missing_labels = []
    errors = []

    total_instances = 0

    for image in images:

        label = find_label(
            image,
            split_dir
        )

        if label is None:

            missing_labels.append(
                str(image)
            )

            continue

        try:

            raw = label.read_text(
                encoding="utf-8",
                errors="ignore"
            )

        except Exception:

            missing_labels.append(
                str(image)
            )

            continue

        if not raw.strip():

            empty_labels.append(
                str(label)
            )

            continue

        before = total_instances

        count, image_classes = process_label(
            label,
            class_instances,
            class_images,
            bbox_areas,
            formats,
            errors
        )

        total_instances += count

        for class_name in image_classes:
            class_images[class_name] += 1

    # ========================================================
    # Split report
    # ========================================================

    print("\nClass distribution:")
    print("-" * 75)

    print(
        f"{'Class':<25}"
        f"{'Images':>10}"
        f"{'Instances':>12}"
    )

    print("-" * 75)

    for class_name in CLASS_NAMES:

        print(
            f"{class_name:<25}"
            f"{class_images[class_name]:>10}"
            f"{class_instances[class_name]:>12}"
        )

    print("-" * 75)

    print(
        f"\nTotal instances: {total_instances}"
    )

    print("\nAnnotation format:")

    print(
        f"  Detection:     "
        f"{formats['detection']}"
    )

    print(
        f"  Segmentation:  "
        f"{formats['segmentation']}"
    )

    print(
        f"  Empty labels:  "
        f"{len(empty_labels)}"
    )

    print(
        f"  Missing labels:"
        f" {len(missing_labels)}"
    )

    print(
        f"  Errors:        "
        f"{len(errors)}"
    )

    # ========================================================
    # BBox statistics
    # ========================================================

    print("\nBounding box statistics:")
    print("-" * 75)

    print(
        f"{'Class':<25}"
        f"{'Avg Area':>12}"
        f"{'<1%':>10}"
        f"{'<2%':>10}"
    )

    print("-" * 75)

    for class_name in CLASS_NAMES:

        areas = bbox_areas[class_name]

        if not areas:

            print(
                f"{class_name:<25}"
                f"{'NO DATA':>12}"
            )

            continue

        avg = sum(areas) / len(areas)

        tiny1 = (
            sum(a < 0.01 for a in areas)
            / len(areas)
            * 100
        )

        tiny2 = (
            sum(a < 0.02 for a in areas)
            / len(areas)
            * 100
        )

        print(
            f"{class_name:<25}"
            f"{avg:>12.4f}"
            f"{tiny1:>9.1f}%"
            f"{tiny2:>9.1f}%"
        )

    return {
        "images": len(images),
        "instances": class_instances,
        "image_counts": class_images,
        "formats": formats,
        "empty": empty_labels,
        "missing": missing_labels,
        "errors": errors,
    }


# ============================================================
# Run
# ============================================================

results = {}

for split in SPLITS:

    results[split] = audit_split(
        split
    )


# ============================================================
# FINAL SUMMARY
# ============================================================

print("\n")
print("=" * 75)
print("FINAL CLASS SUMMARY")
print("=" * 75)

print(
    f"\n{'Class':<25}"
    f"{'TRAIN':>10}"
    f"{'VALID':>10}"
    f"{'TEST':>10}"
    f"{'TOTAL':>10}"
)

print("-" * 75)

for class_name in CLASS_NAMES:

    tr = results["train"]["instances"][class_name]
    va = results["valid"]["instances"][class_name]
    te = results["test"]["instances"][class_name]

    print(
        f"{class_name:<25}"
        f"{tr:>10}"
        f"{va:>10}"
        f"{te:>10}"
        f"{tr + va + te:>10}"
    )


# ============================================================
# FORMAT SUMMARY
# ============================================================

print("\n")
print("=" * 75)
print("ANNOTATION FORMAT SUMMARY")
print("=" * 75)

for split in SPLITS:

    r = results[split]

    print(f"\n{split.upper()}")

    print(
        f"  Detection:     "
        f"{r['formats']['detection']}"
    )

    print(
        f"  Segmentation:  "
        f"{r['formats']['segmentation']}"
    )

    print(
        f"  Empty labels:  "
        f"{len(r['empty'])}"
    )

    print(
        f"  Missing labels: "
        f"{len(r['missing'])}"
    )

    print(
        f"  Errors:        "
        f"{len(r['errors'])}"
    )


print("\n")
print("=" * 75)
print("AUDIT COMPLETE")
print("=" * 75)
