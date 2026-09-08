from pathlib import Path

from PIL import Image

from app.services.crop_disease_model import (
    crop_disease_model,
)


IMAGE_PATH = Path(
    r"D:\KisanX\ml\dataset\split\test\RedRot"
)


def main():

    images = [
        file
        for file in IMAGE_PATH.iterdir()
        if file.suffix.lower()
        in {
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
        }
    ]

    if not images:
        raise RuntimeError(
            "No test images found."
        )

    image_path = images[0]

    print(
        "Testing image:",
        image_path
    )

    image = Image.open(
        image_path
    ).convert("RGB")

    result = crop_disease_model.predict(
        image
    )

    print()
    print("Prediction:")
    print(
        "Disease:",
        result["disease"]
    )

    print(
        "Confidence:",
        result["confidence"]
    )

    print(
        "Confidence %:",
        round(
            result["confidence"] * 100,
            2
        )
    )

    print()
    print("All probabilities:")

    for disease, probability in (
        result["class_probabilities"]
        .items()
    ):

        print(
            f"{disease:10} "
            f"{probability * 100:.2f}%"
        )


if __name__ == "__main__":
    main()
