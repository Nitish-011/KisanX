from pathlib import Path
import cv2
import numpy as np
from ultralytics import YOLO

MODEL = r"D:\KisanX\frontend\ml\cotton\runs\yolo26n_seg_clean\weights\best.pt"
SOURCE = r"D:\KisanX\frontend\ml\cotton\data\cotton_seg_clean\test\images"

CONF = 0.25

model = YOLO(MODEL)

results = model.predict(
    source=SOURCE,
    imgsz=640,
    conf=CONF,
    device=0,
    verbose=False,
)

print("\n" + "=" * 75)
print("KISANX COTTON HEALTH ESTIMATION - CORRECTED")
print("=" * 75)

for result in results:

    name = Path(result.path).name

    print(f"\n{name}")
    print("-" * 75)

    if result.masks is None:
        print("No masks detected.")
        print("KisanX status: UNKNOWN")
        continue

    h, w = result.orig_shape

    masks = result.masks.data.cpu().numpy()
    classes = result.boxes.cls.cpu().numpy().astype(int)
    confidences = result.boxes.conf.cpu().numpy()

    # ---------------------------------------------------------
    # Build union masks
    # ---------------------------------------------------------

    healthy_mask = np.zeros((h, w), dtype=bool)
    affected_mask = np.zeros((h, w), dtype=bool)
    all_crop_mask = np.zeros((h, w), dtype=bool)

    detections = []

    for mask, cls, conf in zip(
        masks,
        classes,
        confidences
    ):

        mask = cv2.resize(
            mask,
            (w, h),
            interpolation=cv2.INTER_NEAREST
        )

        binary = mask > 0.5

        class_name = model.names[int(cls)]
        pixels = int(binary.sum())

        detections.append(
            (class_name, float(conf), pixels)
        )

        # Union of every detected mask
        all_crop_mask |= binary

        if class_name == "Healthy":
            healthy_mask |= binary
        else:
            affected_mask |= binary

    # ---------------------------------------------------------
    # Remove overlap between healthy and affected
    # Disease takes priority.
    # ---------------------------------------------------------

    healthy_mask &= ~affected_mask

    crop_pixels = int(all_crop_mask.sum())
    healthy_pixels = int(healthy_mask.sum())
    affected_pixels = int(affected_mask.sum())

    if crop_pixels == 0:
        print("No valid crop area detected.")
        print("KisanX status: UNKNOWN")
        continue

    # ---------------------------------------------------------
    # Percentages
    # ---------------------------------------------------------

    healthy_percent = (
        healthy_pixels / crop_pixels
    ) * 100

    affected_percent = (
        affected_pixels / crop_pixels
    ) * 100

    # Clamp for numerical safety
    healthy_percent = max(
        0,
        min(100, healthy_percent)
    )

    affected_percent = max(
        0,
        min(100, affected_percent)
    )

    # ---------------------------------------------------------
    # Print detections
    # ---------------------------------------------------------

    for class_name, confidence, pixels in detections:

        print(
            f"{class_name:<22} "
            f"confidence={confidence:.2f} "
            f"mask_pixels={pixels:,}"
        )

    print("\nArea analysis:")
    print(f"Detected crop area : {crop_pixels:,} pixels")
    print(f"Healthy area       : {healthy_percent:.1f}%")
    print(f"Affected area      : {affected_percent:.1f}%")

    # ---------------------------------------------------------
    # KisanX health score
    # ---------------------------------------------------------

    health_score = healthy_percent

    if health_score >= 80:
        status = "HEALTHY"
    elif health_score >= 60:
        status = "MODERATE RISK"
    elif health_score >= 40:
        status = "HIGH RISK"
    else:
        status = "CRITICAL"

    print(f"KisanX health score: {health_score:.1f}/100")
    print(f"KisanX status      : {status}")

print("\n" + "=" * 75)