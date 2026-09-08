from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image
from ultralytics import YOLO


# ============================================================
# MODEL CONFIG
# ============================================================

MODEL_PATH = Path(
    r"D:\KisanX\frontend\ml\cotton\runs\yolo26n_seg_clean\weights\best.pt"
)

CONFIDENCE_THRESHOLD = 0.25

HEALTHY_CLASS = "Healthy"


# ============================================================
# LOAD MODEL ONCE
# ============================================================

@lru_cache(maxsize=1)
def get_cotton_model() -> YOLO:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Cotton YOLO model not found at: {MODEL_PATH}"
        )

    return YOLO(str(MODEL_PATH))


# ============================================================
# SEVERITY
# ============================================================

def calculate_severity(
    confidence: float,
    detection_coverage: float,
) -> tuple[float, str]:
    """
    Prototype AI risk score.

    IMPORTANT:
    detection_coverage is NOT crop damage percentage.
    It is the percentage of the image covered by the
    detected segmentation masks.

    Risk score combines:
        50% confidence
        50% detection coverage
    """

    confidence_score = confidence * 100.0

    coverage_score = min(
        max(detection_coverage, 0.0),
        100.0,
    )

    risk_score = (
        0.5 * confidence_score
        + 0.5 * coverage_score
    )

    if risk_score < 25:
        severity = "LOW"
    elif risk_score < 50:
        severity = "MODERATE"
    elif risk_score < 75:
        severity = "HIGH"
    else:
        severity = "SEVERE"

    return round(risk_score, 2), severity


# ============================================================
# IMAGE CONVERSION
# ============================================================

def pil_to_numpy(image: Image.Image) -> np.ndarray:
    return np.asarray(
        image.convert("RGB")
    )


# ============================================================
# YOLO INFERENCE
# ============================================================

def predict_cotton(
    image: Image.Image,
) -> dict[str, Any]:

    model = get_cotton_model()

    image_np = pil_to_numpy(image)

    try:
        results = model.predict(
            source=image_np,
            imgsz=640,
            conf=CONFIDENCE_THRESHOLD,
            verbose=False,
            device=0,
        )
    except Exception as exc:
        raise RuntimeError(
            f"Cotton YOLO inference failed: {exc}"
        ) from exc

    if not results:
        return {
            "crop": "Cotton",
            "disease": None,
            "confidence": 0.0,
            "confidence_percent": 0.0,
            "severity": "UNCERTAIN",
            "risk_score": 0.0,
            "detection_coverage": 0.0,
            "predictions": [],
        }

    result = results[0]

    names = result.names or {}

    predictions: list[dict[str, Any]] = []

    image_height, image_width = image_np.shape[:2]
    image_area = float(
        image_height * image_width
    )

    total_mask_area = 0.0

    # ========================================================
    # SEGMENTATION MASKS
    # ========================================================

    if result.masks is not None:

        masks = result.masks.data.cpu().numpy()

        boxes = (
            result.boxes
            if result.boxes is not None
            else None
        )

        if boxes is not None:
            class_ids = (
                boxes.cls.cpu().numpy().astype(int)
            )

            confidences = (
                boxes.conf.cpu().numpy()
            )

            for index, class_id in enumerate(
                class_ids
            ):
                confidence = float(
                    confidences[index]
                )

                class_name = str(
                    names.get(
                        int(class_id),
                        str(class_id),
                    )
                )

                mask = masks[index]

                mask_area = float(
                    np.count_nonzero(mask > 0.5)
                )

                # Resize mask to original image size
                mask_image = Image.fromarray(
                    (
                        (mask > 0.5).astype(np.uint8)
                        * 255
                    )
                ).resize(
                    (image_width, image_height)
                )

                resized_mask = np.asarray(
                    mask_image
                ) > 127

                mask_area = float(
                    np.count_nonzero(
                        resized_mask
                    )
                )

                total_mask_area += mask_area

                predictions.append(
                    {
                        "class_id": int(class_id),
                        "class_name": class_name,
                        "confidence": round(
                            confidence,
                            4,
                        ),
                        "confidence_percent": round(
                            confidence * 100,
                            2,
                        ),
                        "mask_area_pixels": int(
                            mask_area
                        ),
                    }
                )

    # ========================================================
    # FALLBACK FOR BOXES
    # ========================================================

    elif result.boxes is not None:

        class_ids = (
            result.boxes.cls.cpu()
            .numpy()
            .astype(int)
        )

        confidences = (
            result.boxes.conf.cpu()
            .numpy()
        )

        boxes_xyxy = (
            result.boxes.xyxy.cpu()
            .numpy()
        )

        for index, class_id in enumerate(
            class_ids
        ):
            confidence = float(
                confidences[index]
            )

            class_name = str(
                names.get(
                    int(class_id),
                    str(class_id),
                )
            )

            x1, y1, x2, y2 = boxes_xyxy[index]

            box_area = max(
                0.0,
                x2 - x1,
            ) * max(
                0.0,
                y2 - y1,
            )

            total_mask_area += box_area

            predictions.append(
                {
                    "class_id": int(class_id),
                    "class_name": class_name,
                    "confidence": round(
                        confidence,
                        4,
                    ),
                    "confidence_percent": round(
                        confidence * 100,
                        2,
                    ),
                    "mask_area_pixels": int(
                        box_area
                    ),
                }
            )

    # ========================================================
    # NO DETECTION
    # ========================================================

    if not predictions:

        return {
            "crop": "Cotton",
            "disease": None,
            "confidence": 0.0,
            "confidence_percent": 0.0,
            "severity": "UNCERTAIN",
            "risk_score": 0.0,
            "detection_coverage": 0.0,
            "predictions": [],
        }

    # ========================================================
    # SORT BY CONFIDENCE
    # ========================================================

    predictions.sort(
        key=lambda item: item["confidence"],
        reverse=True,
    )

    primary = predictions[0]

    primary_class = primary["class_name"]
    primary_confidence = float(
        primary["confidence"]
    )

    # ========================================================
    # DETECTION COVERAGE
    # ========================================================

    detection_coverage = (
        total_mask_area / image_area
    ) * 100.0

    detection_coverage = min(
        max(detection_coverage, 0.0),
        100.0,
    )

    # ========================================================
    # HEALTHY HANDLING
    # ========================================================

    if primary_class.lower() == HEALTHY_CLASS.lower():

        if primary_confidence >= 0.70:
            severity = "HEALTHY"
        else:
            severity = "UNCERTAIN"

        risk_score = 0.0

    else:

        risk_score, severity = calculate_severity(
            confidence=primary_confidence,
            detection_coverage=detection_coverage,
        )

    # ========================================================
    # FINAL RESPONSE
    # ========================================================

    return {
        "crop": "Cotton",
        "disease": primary_class,
        "confidence": round(
            primary_confidence,
            4,
        ),
        "confidence_percent": round(
            primary_confidence * 100,
            2,
        ),
        "severity": severity,
        "risk_score": risk_score,
        "detection_coverage": round(
            detection_coverage,
            2,
        ),
        "predictions": predictions,
    }
    