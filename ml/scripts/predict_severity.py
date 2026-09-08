from pathlib import Path
import json

import cv2
import numpy as np
from ultralytics import YOLO


PROJECT_ROOT = Path(r"D:\KisanX")

MODEL_PATH = (
    PROJECT_ROOT
    / "ml"
    / "runs"
    / "sugarcane_severity_yolo11m_seg-2"
    / "weights"
    / "best.pt"
)

OUTPUT_DIR = (
    PROJECT_ROOT
    / "ml"
    / "outputs"
    / "severity"
)

OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


def severity_from_percentage(
    affected_area_percent: float,
) -> str:

    if affected_area_percent < 10:
        return "Low"

    if affected_area_percent < 30:
        return "Moderate"

    if affected_area_percent < 60:
        return "High"

    return "Severe"


def main():

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found:\n{MODEL_PATH}"
        )

    print("=" * 70)
    print("KISANX SEVERITY MODEL")
    print("=" * 70)
    print(f"Model: {MODEL_PATH}")

    model = YOLO(
        str(MODEL_PATH)
    )

    print("Model loaded successfully.")
    print(
        f"Classes: {model.names}"
    )

    image_path = input(
        "\nEnter image path: "
    ).strip().strip('"')

    image_path = Path(
        image_path
    )

    if not image_path.exists():
        raise FileNotFoundError(
            f"Image not found:\n{image_path}"
        )

    results = model.predict(
        source=str(image_path),
        imgsz=640,
        conf=0.25,
        device=0,
        verbose=False,
    )

    result = results[0]

    image = cv2.imread(
        str(image_path)
    )

    if image is None:
        raise ValueError(
            "Could not read image."
        )

    image_height, image_width = image.shape[:2]

    total_image_pixels = (
        image_height
        * image_width
    )

    if (
        result.masks is None
        or result.boxes is None
        or len(result.boxes) == 0
    ):

        print("\nNo disease region detected.")

        output = {
            "success": True,
            "image": str(image_path),
            "detections": [],
            "total_affected_area_percent": 0.0,
            "severity": "Low",
        }

        json_path = (
            OUTPUT_DIR
            / f"{image_path.stem}_severity.json"
        )

        with open(
            json_path,
            "w",
            encoding="utf-8",
        ) as file:
            json.dump(
                output,
                file,
                indent=2,
            )

        print(
            f"JSON saved: {json_path}"
        )

        return

    masks = (
        result.masks.data
        .detach()
        .cpu()
        .numpy()
    )

    classes = (
        result.boxes.cls
        .detach()
        .cpu()
        .numpy()
        .astype(int)
    )

    confidences = (
        result.boxes.conf
        .detach()
        .cpu()
        .numpy()
    )

    combined_mask = np.zeros(
        (
            image_height,
            image_width,
        ),
        dtype=np.uint8,
    )

    detections = []

    for index, mask in enumerate(masks):

        mask_resized = cv2.resize(
            mask,
            (
                image_width,
                image_height,
            ),
            interpolation=cv2.INTER_NEAREST,
        )

        binary_mask = (
            mask_resized > 0.5
        ).astype(np.uint8)

        mask_pixels = int(
            np.count_nonzero(
                binary_mask
            )
        )

        combined_mask = np.maximum(
            combined_mask,
            binary_mask,
        )

        class_id = int(
            classes[index]
        )

        confidence = float(
            confidences[index]
        )

        class_name = model.names[
            class_id
        ]

        detections.append(
            {
                "class_id": class_id,
                "disease": class_name,
                "confidence": round(
                    confidence,
                    6,
                ),
                "mask_pixels": mask_pixels,
            }
        )

    affected_pixels = int(
        np.count_nonzero(
            combined_mask
        )
    )

    affected_area_percent = (
        affected_pixels
        / total_image_pixels
        * 100
    )

    affected_area_percent = round(
        affected_area_percent,
        2,
    )

    severity = severity_from_percentage(
        affected_area_percent
    )

    overlay = image.copy()

    overlay[
        combined_mask == 1
    ] = (
        overlay[
            combined_mask == 1
        ] * 0.45
        + np.array(
            [0, 180, 0]
        ) * 0.55
    ).astype(np.uint8)

    annotated = cv2.addWeighted(
        image,
        0.55,
        overlay,
        0.45,
        0,
    )

    if result.boxes is not None:

        boxes = (
            result.boxes.xyxy
            .detach()
            .cpu()
            .numpy()
        )

        for index, box in enumerate(
            boxes
        ):

            x1, y1, x2, y2 = (
                box.astype(int)
            )

            class_id = int(
                classes[index]
            )

            confidence = float(
                confidences[index]
            )

            class_name = model.names[
                class_id
            ]

            label = (
                f"{class_name} "
                f"{confidence * 100:.1f}%"
            )

            cv2.rectangle(
                annotated,
                (x1, y1),
                (x2, y2),
                (0, 255, 0),
                2,
            )

            cv2.putText(
                annotated,
                label,
                (x1, max(y1 - 10, 20)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 0),
                2,
            )

    cv2.putText(
        annotated,
        f"Affected Area: {affected_area_percent:.2f}%",
        (20, 35),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2,
    )

    cv2.putText(
        annotated,
        f"Severity: {severity}",
        (20, 70),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2,
    )

    annotated_path = (
        OUTPUT_DIR
        / f"{image_path.stem}_severity.jpg"
    )

    json_path = (
        OUTPUT_DIR
        / f"{image_path.stem}_severity.json"
    )

    cv2.imwrite(
        str(annotated_path),
        annotated,
    )

    output = {
        "success": True,
        "image": str(image_path),
        "model": str(MODEL_PATH),
        "detections": detections,
        "affected_pixels": affected_pixels,
        "total_image_pixels": total_image_pixels,
        "affected_area_percent": affected_area_percent,
        "severity": severity,
    }

    with open(
        json_path,
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            output,
            file,
            indent=2,
        )

    print("\n" + "=" * 70)
    print("KISANX SEVERITY RESULT")
    print("=" * 70)

    for detection in detections:

        print(
            f"Disease     : "
            f"{detection['disease']}"
        )

        print(
            f"Confidence  : "
            f"{detection['confidence'] * 100:.2f}%"
        )

        print(
            f"Mask pixels : "
            f"{detection['mask_pixels']}"
        )

        print("-" * 70)

    print(
        f"Affected area : "
        f"{affected_area_percent:.2f}%"
    )

    print(
        f"Severity      : "
        f"{severity}"
    )

    print(
        f"\nAnnotated image:"
        f"\n{annotated_path}"
    )

    print(
        f"\nJSON result:"
        f"\n{json_path}"
    )

    print("=" * 70)


if __name__ == "__main__":
    main()
