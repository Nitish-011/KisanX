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


def severity_from_score(score):
    if score < 25:
        return "LOW"
    elif score < 50:
        return "MODERATE"
    elif score < 75:
        return "HIGH"
    else:
        return "SEVERE"


print("\n" + "=" * 75)
print("KISANX COTTON AI HEALTH & RISK ENGINE")
print("=" * 75)

for result in results:

    image_name = Path(result.path).name

    print(f"\n{image_name}")
    print("-" * 75)

    if result.masks is None:
        print("Disease/Pest : None detected")
        print("Confidence   : --")
        print("Risk         : LOW")
        print("Status       : NO DETECTION")
        continue

    h, w = result.orig_shape
    image_area = h * w

    masks = result.masks.data.cpu().numpy()
    classes = result.boxes.cls.cpu().numpy().astype(int)
    confidences = result.boxes.conf.cpu().numpy()

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

        pixels = int(binary.sum())

        class_name = model.names[int(cls)]

        coverage = (
            pixels / image_area
        ) * 100

        detections.append({
            "class": class_name,
            "confidence": float(conf),
            "coverage": coverage,
        })

    # ---------------------------------------------------------
    # HEALTHY CLASS
    # ---------------------------------------------------------

    healthy = [
        d for d in detections
        if d["class"] == "Healthy"
    ]

    diseases = [
        d for d in detections
        if d["class"] != "Healthy"
    ]

    # Strong healthy prediction with no disease detection
    if healthy and not diseases:

        best = max(
            healthy,
            key=lambda x: x["confidence"]
        )

        confidence = best["confidence"]

        if confidence >= 0.80:
            status = "HEALTHY"
            risk = "LOW"
        elif confidence >= 0.50:
            status = "LIKELY HEALTHY"
            risk = "LOW"
        else:
            status = "UNCERTAIN"
            risk = "MODERATE"

        print(f"Disease/Pest : None")
        print(f"Healthy conf : {confidence:.2f}")
        print(f"Risk         : {risk}")
        print(f"Status       : {status}")

        continue

    # ---------------------------------------------------------
    # DISEASE / PEST
    # ---------------------------------------------------------

    if diseases:

        # Highest-confidence disease
        primary = max(
            diseases,
            key=lambda x: x["confidence"]
        )

        confidence = primary["confidence"]

        # Union of disease masks
        disease_union = np.zeros(
            (h, w),
            dtype=bool
        )

        for mask, cls, conf in zip(
            masks,
            classes,
            confidences
        ):

            class_name = model.names[int(cls)]

            if class_name == "Healthy":
                continue

            mask = cv2.resize(
                mask,
                (w, h),
                interpolation=cv2.INTER_NEAREST
            )

            disease_union |= mask > 0.5

        disease_pixels = int(
            disease_union.sum()
        )

        coverage = (
            disease_pixels / image_area
        ) * 100

        # -----------------------------------------------------
        # Prototype severity score
        #
        # IMPORTANT:
        # This is NOT true agronomic damage percentage.
        # -----------------------------------------------------

        coverage_score = min(
            coverage,
            50
        ) / 50 * 50

        confidence_score = confidence * 50

        score = (
            coverage_score +
            confidence_score
        )

        score = min(
            100,
            score
        )

        severity = severity_from_score(score)

        print(
            f"Disease/Pest : {primary['class']}"
        )

        print(
            f"Confidence   : {confidence:.2f}"
        )

        print(
            f"Detection coverage : "
            f"{coverage:.2f}%"
        )

        print(
            f"AI risk score: "
            f"{score:.1f}/100"
        )

        print(
            f"Severity     : "
            f"{severity}"
        )

        if len(diseases) > 1:
            print(
                f"Additional detections: "
                f"{len(diseases) - 1}"
            )

    else:

        print("No disease/pest detected.")
        print("Status: HEALTHY / NO DETECTION")

print("\n" + "=" * 75)

print(
    "NOTE: Detection coverage and AI risk score "
    "are prototype signals, not measured crop-damage percentage."
)

print("=" * 75)