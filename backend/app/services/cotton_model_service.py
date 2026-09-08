from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image
from ultralytics import YOLO


# ============================================================
# COTTON MODEL CONFIGURATION
# ============================================================

MODEL_PATH = Path(
    r"D:\KisanX\frontend\ml\cotton\runs\yolo26n_seg_clean\weights\best.pt"
)

COTTON_CLASSES = [
    "Aphids",
    "Army worm",
    "Bacterial blight",
    "Fuserium wilt",
    "Healthy",
    "Leaf curl",
]


# ============================================================
# MODEL LOADING
# ============================================================

@lru_cache(maxsize=1)
def get_cotton_model() -> YOLO:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Cotton YOLO model not found: {MODEL_PATH}"
        )

    return YOLO(str(MODEL_PATH))


# ============================================================
# SEVERITY CALCULATION
# ============================================================

def calculate_severity(
    confidence: float,
    detection_coverage: float,
    disease: str,
) -> dict[str, Any]:

    # Healthy prediction
    if disease.strip().lower() == "healthy":
        return {
            "severity": (
                "HEALTHY"
                if confidence >= 0.60
                else "UNCERTAIN"
            ),
            "risk_score": 0.0,
        }

    # Prototype risk calculation:
    # 50% confidence + 50% segmentation coverage
    risk_score = (
        (confidence * 50.0)
        + (detection_coverage * 0.50)
    )

    if risk_score < 25:
        severity = "LOW"
    elif risk_score < 50:
        severity = "MODERATE"
    elif risk_score < 75:
        severity = "HIGH"
    else:
        severity = "SEVERE"

    return {
        "severity": severity,
        "risk_score": round(risk_score, 2),
    }


# ============================================================
# PREDICTION
# ============================================================

def predict_cotton(image: Image.Image) -> dict[str, Any]:

    if image is None:
        raise ValueError("Image is required.")

    image = image.convert("RGB")

    model = get_cotton_model()

    results = model.predict(
        source=np.asarray(image),
        verbose=False,
        conf=0.25,
    )

    if not results:
        return {
            "crop": "Cotton",
            "disease": "NO_DETECTION",
            "confidence": 0.0,
            "confidence_percent": 0.0,
            "class_probabilities": {},
            "detection_coverage": 0.0,
            "risk_score": 0.0,
            "severity": "UNCERTAIN",
            "predictions": [],
            "model": "YOLO26n-seg",
        }

    result = results[0]

    boxes = result.boxes
    masks = result.masks

    if boxes is None or len(boxes) == 0:
        return {
            "crop": "Cotton",
            "disease": "NO_DETECTION",
            "confidence": 0.0,
            "confidence_percent": 0.0,
            "class_probabilities": {},
            "detection_coverage": 0.0,
            "risk_score": 0.0,
            "severity": "UNCERTAIN",
            "predictions": [],
            "model": "YOLO26n-seg",
        }

    names = result.names

    predictions = []
    class_probabilities: dict[str, float] = {}

    best_index = 0
    best_confidence = 0.0

    # --------------------------------------------------------
    # DETECTIONS
    # --------------------------------------------------------

    for index in range(len(boxes)):

        confidence = float(
            boxes.conf[index].item()
        )

        class_id = int(
            boxes.cls[index].item()
        )

        disease = names.get(
            class_id,
            COTTON_CLASSES[class_id]
            if class_id < len(COTTON_CLASSES)
            else str(class_id),
        )

        confidence_percent = confidence * 100.0

        predictions.append(
            {
                "disease": disease,
                "confidence": round(
                    confidence,
                    4,
                ),
                "confidence_percent": round(
                    confidence_percent,
                    2,
                ),
            }
        )

        # Keep highest confidence per class
        previous = class_probabilities.get(
            disease,
            0.0,
        )

        class_probabilities[disease] = max(
            previous,
            confidence,
        )

        if confidence > best_confidence:
            best_confidence = confidence
            best_index = index

    # --------------------------------------------------------
    # PRIMARY PREDICTION
    # --------------------------------------------------------

    best_class_id = int(
        boxes.cls[best_index].item()
    )

    disease = names.get(
        best_class_id,
        COTTON_CLASSES[best_class_id]
        if best_class_id < len(COTTON_CLASSES)
        else str(best_class_id),
    )

    confidence = float(
        boxes.conf[best_index].item()
    )

    # --------------------------------------------------------
    # SEGMENTATION COVERAGE
    # --------------------------------------------------------

    detection_coverage = 0.0

    if masks is not None and len(masks) > 0:

        mask_data = masks.data

        total_mask_pixels = 0.0

        for mask in mask_data:
            total_mask_pixels += float(
                (mask > 0.5).sum().item()
            )

        image_width, image_height = image.size

        image_area = float(
            image_width * image_height
        )

        if image_area > 0:
            detection_coverage = (
                total_mask_pixels
                / image_area
                * 100.0
            )

            detection_coverage = min(
                detection_coverage,
                100.0,
            )

    # --------------------------------------------------------
    # SEVERITY
    # --------------------------------------------------------

    severity_result = calculate_severity(
        confidence=confidence,
        detection_coverage=detection_coverage,
        disease=disease,
    )

    return {
        "crop": "Cotton",
        "disease": disease,
        "confidence": round(
            confidence,
            4,
        ),
        "confidence_percent": round(
            confidence * 100.0,
            2,
        ),
        "class_probabilities": {
            key: round(value, 4)
            for key, value
            in class_probabilities.items()
        },
        "detection_coverage": round(
            detection_coverage,
            2,
        ),
        "risk_score": severity_result[
            "risk_score"
        ],
        "severity": severity_result[
            "severity"
        ],
        "predictions": predictions,
        "model": "YOLO26n-seg",
    }