from pathlib import Path
import argparse
import json

import cv2
import numpy as np


DEFAULT_OUTPUT_DIR = Path(
    r"D:\KisanX\ml\outputs\severity_rgb"
)


DISEASES = {
    "Mosaic",
    "RedRot",
    "Rust",
    "Yellow",
}


def load_image(image_path: Path):

    image = cv2.imread(
        str(image_path),
        cv2.IMREAD_COLOR,
    )

    if image is None:
        raise ValueError(
            f"Could not read image:\n{image_path}"
        )

    return image


def estimate_leaf_mask(image):

    hsv = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2HSV,
    )

    lower_green = np.array(
        [20, 25, 20],
        dtype=np.uint8,
    )

    upper_green = np.array(
        [105, 255, 255],
        dtype=np.uint8,
    )

    mask = cv2.inRange(
        hsv,
        lower_green,
        upper_green,
    )

    saturation = hsv[:, :, 1]
    value = hsv[:, :, 2]

    broad_green = (
        (saturation > 20)
        & (value > 20)
    ).astype(np.uint8) * 255

    mask = cv2.bitwise_and(
        mask,
        broad_green,
    )

    kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE,
        (7, 7),
    )

    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_CLOSE,
        kernel,
        iterations=2,
    )

    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_OPEN,
        kernel,
        iterations=1,
    )

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
        mask,
        connectivity=8,
    )

    if num_labels <= 1:
        return mask

    largest_label = 1 + np.argmax(
        stats[1:, cv2.CC_STAT_AREA]
    )

    leaf_mask = np.zeros_like(mask)

    leaf_mask[
        labels == largest_label
    ] = 255

    return leaf_mask


def estimate_symptom_mask(
    image,
    leaf_mask,
    disease,
):

    hsv = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2HSV,
    )

    lab = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2LAB,
    )

    h = hsv[:, :, 0]
    s = hsv[:, :, 1]
    v = hsv[:, :, 2]

    l = lab[:, :, 0]
    a = lab[:, :, 1]
    b = lab[:, :, 2]

    leaf = leaf_mask > 0

    red_1 = (
        (h < 12)
        & (s > 45)
        & (v > 35)
    )

    red_2 = (
        (h > 165)
        & (s > 45)
        & (v > 35)
    )

    brown = (
        (h >= 5)
        & (h <= 30)
        & (s > 55)
        & (v < 210)
    )

    red_brown = (
        red_1
        | red_2
        | brown
    )

    yellow = (
        (h >= 20)
        & (h <= 45)
        & (s > 35)
        & (v > 80)
    )

    pale = (
        (s < 75)
        & (v > 115)
        & (l > 125)
    )

    dark = (
        (v < 75)
        & (s > 25)
    )

    if disease == "RedRot":
        symptom = (
            red_brown
            | dark
        )

    elif disease == "Rust":
        symptom = (
            red_brown
            | dark
        )

    elif disease == "Yellow":
        symptom = (
            yellow
            | pale
        )

    elif disease == "Mosaic":
        symptom = (
            pale
            | yellow
            | dark
        )

    else:
        symptom = (
            red_brown
            | yellow
            | pale
            | dark
        )

    symptom = (
        symptom
        & leaf
    )

    symptom_mask = (
        symptom.astype(np.uint8)
        * 255
    )

    kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE,
        (5, 5),
    )

    symptom_mask = cv2.morphologyEx(
        symptom_mask,
        cv2.MORPH_OPEN,
        kernel,
        iterations=1,
    )

    symptom_mask = cv2.morphologyEx(
        symptom_mask,
        cv2.MORPH_CLOSE,
        kernel,
        iterations=1,
    )

    return symptom_mask


def calculate_features(
    image,
    leaf_mask,
    symptom_mask,
):

    leaf_pixels = (
        leaf_mask > 0
    )

    symptom_pixels = (
        symptom_mask > 0
    )

    leaf_area = int(
        np.count_nonzero(
            leaf_pixels
        )
    )

    symptom_area = int(
        np.count_nonzero(
            symptom_pixels
        )
    )

    if leaf_area == 0:
        return {
            "leaf_pixels": 0,
            "symptom_pixels": 0,
            "affected_ratio": 0.0,
            "affected_percent": 0.0,
            "symptom_density": 0.0,
            "fragmentation": 0.0,
        }

    affected_ratio = (
        symptom_area
        / leaf_area
    )

    num_labels, _, stats, _ = (
        cv2.connectedComponentsWithStats(
            symptom_mask,
            connectivity=8,
        )
    )

    component_areas = []

    for i in range(
        1,
        num_labels,
    ):
        area = stats[
            i,
            cv2.CC_STAT_AREA,
        ]

        if area >= 20:
            component_areas.append(
                int(area)
            )

    if component_areas:
        fragmentation = (
            len(component_areas)
            / max(
                1,
                symptom_area / 10000,
            )
        )

        fragmentation = min(
            fragmentation,
            10.0,
        )

    else:
        fragmentation = 0.0

    symptom_density = (
        symptom_area
        / max(
            1,
            leaf_area,
        )
    )

    return {
        "leaf_pixels": leaf_area,
        "symptom_pixels": symptom_area,
        "affected_ratio": float(
            affected_ratio
        ),
        "affected_percent": float(
            affected_ratio * 100
        ),
        "symptom_density": float(
            symptom_density
        ),
        "fragmentation": float(
            fragmentation
        ),
    }


def calculate_severity_score(
    features,
):

    affected_percent = (
        features["affected_percent"]
    )

    fragmentation = (
        features["fragmentation"]
    )

    area_score = min(
        affected_percent * 2.0,
        80.0,
    )

    fragmentation_score = min(
        fragmentation * 2.0,
        20.0,
    )

    score = (
        area_score
        + fragmentation_score
    )

    score = max(
        0.0,
        min(
            100.0,
            score,
        ),
    )

    return score


def severity_class(score):

    if score < 25:
        return "Mild"

    if score < 55:
        return "Moderate"

    return "Severe"


def create_visualization(
    image,
    leaf_mask,
    symptom_mask,
    disease,
    severity,
    score,
    output_path,
):

    result = image.copy()

    contours, _ = cv2.findContours(
        leaf_mask,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )

    cv2.drawContours(
        result,
        contours,
        -1,
        (0, 255, 0),
        2,
    )

    symptom_indices = (
        symptom_mask > 0
    )

    overlay = result.copy()

    overlay[
        symptom_indices
    ] = (
        0,
        0,
        255,
    )

    result = cv2.addWeighted(
        result,
        0.70,
        overlay,
        0.30,
        0,
    )

    panel_height = 115

    panel = np.zeros(
        (
            panel_height,
            result.shape[1],
            3,
        ),
        dtype=np.uint8,
    )

    result = np.vstack(
        [
            panel,
            result,
        ]
    )

    cv2.putText(
        result,
        f"Disease: {disease}",
        (20, 35),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2,
    )

    cv2.putText(
        result,
        f"Severity: {severity}",
        (20, 70),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2,
    )

    cv2.putText(
        result,
        f"Estimated score: {score:.1f}/100",
        (20, 105),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 255, 255),
        2,
    )

    cv2.imwrite(
        str(output_path),
        result,
    )


def estimate(
    image_path,
    disease,
    output_dir,
):

    image_path = Path(
        image_path
    )

    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    image = load_image(
        image_path
    )

    leaf_mask = estimate_leaf_mask(
        image
    )

    symptom_mask = estimate_symptom_mask(
        image,
        leaf_mask,
        disease,
    )

    features = calculate_features(
        image,
        leaf_mask,
        symptom_mask,
    )

    score = calculate_severity_score(
        features
    )

    severity = severity_class(
        score
    )

    annotated_path = (
        output_dir
        / f"{image_path.stem}_severity.jpg"
    )

    mask_path = (
        output_dir
        / f"{image_path.stem}_mask.png"
    )

    create_visualization(
        image,
        leaf_mask,
        symptom_mask,
        disease,
        severity,
        score,
        annotated_path,
    )

    cv2.imwrite(
        str(mask_path),
        symptom_mask,
    )

    result = {
        "image": str(image_path),
        "disease": disease,
        "severity": severity,
        "severity_score": round(
            float(score),
            2,
        ),
        "method": (
            "RGB_HSV_leaf_symptom_estimation"
        ),
        "validated": False,
        "features": features,
        "annotated_image": str(
            annotated_path
        ),
        "symptom_mask": str(
            mask_path
        ),
    }

    json_path = (
        output_dir
        / f"{image_path.stem}_severity.json"
    )

    with open(
        json_path,
        "w",
        encoding="utf-8",
    ) as f:
        json.dump(
            result,
            f,
            indent=2,
        )

    return result


def main():

    parser = argparse.ArgumentParser(
        description=(
            "KisanX RGB disease severity estimator"
        )
    )

    parser.add_argument(
        "--image",
        required=True,
        help="Path to input image",
    )

    parser.add_argument(
        "--disease",
        required=True,
        choices=[
            "Mosaic",
            "RedRot",
            "Rust",
            "Yellow",
        ],
        help="Disease predicted by MobileNetV3",
    )

    parser.add_argument(
        "--output",
        default=str(
            DEFAULT_OUTPUT_DIR
        ),
        help="Output directory",
    )

    args = parser.parse_args()

    result = estimate(
        image_path=args.image,
        disease=args.disease,
        output_dir=Path(
            args.output
        ),
    )

    print()
    print("=" * 60)
    print("KISANX SEVERITY ESTIMATION")
    print("=" * 60)

    print(
        f"Disease:          {result['disease']}"
    )

    print(
        f"Severity:         {result['severity']}"
    )

    print(
        f"Estimated score:  "
        f"{result['severity_score']}/100"
    )

    print(
        f"Affected area:    "
        f"{result['features']['affected_percent']:.2f}%"
    )

    print(
        f"Annotated image:  "
        f"{result['annotated_image']}"
    )

    print(
        f"JSON:             "
        f"{result['image'].rsplit('.', 1)[0]}_severity.json"
    )

    print("=" * 60)

    print(
        "\nIMPORTANT:"
    )

    print(
        "This is an AI-estimated severity score."
    )

    print(
        "It is NOT validated ground-truth severity."
    )


if __name__ == "__main__":
    main()
