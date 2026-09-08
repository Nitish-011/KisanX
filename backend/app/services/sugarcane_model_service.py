from pathlib import Path
from typing import Dict, Any

import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms


PROJECT_ROOT = Path(r"D:\KisanX")

MODEL_PATH = (
    PROJECT_ROOT
    / "ml"
    / "models"
    / "mobilenet_v3_large_best.pth"
)

IMAGE_SIZE = 224

CLASS_NAMES = [
    "Healthy",
    "Mosaic",
    "RedRot",
    "Rust",
    "Yellow",
]


class CropDiseaseModel:

    def __init__(self):

        self.device = torch.device(
            "cuda"
            if torch.cuda.is_available()
            else "cpu"
        )

        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"MobileNetV3 model not found:\n{MODEL_PATH}"
            )

        print("=" * 60)
        print("Loading KisanX MobileNetV3 disease model...")
        print(f"Model: {MODEL_PATH}")
        print(f"Device: {self.device}")

        if self.device.type == "cuda":
            print(
                f"GPU: {torch.cuda.get_device_name(0)}"
            )

        print("=" * 60)

        self.model = models.mobilenet_v3_large(
            weights=None
        )

        in_features = (
            self.model.classifier[-1].in_features
        )

        self.model.classifier[-1] = nn.Linear(
            in_features,
            len(CLASS_NAMES)
        )

        checkpoint = torch.load(
            MODEL_PATH,
            map_location=self.device,
            weights_only=False,
        )

        if "state_dict" in checkpoint:
            state_dict = checkpoint["state_dict"]
        else:
            state_dict = checkpoint

        self.model.load_state_dict(
            state_dict
        )

        self.model.to(self.device)
        self.model.eval()

        self.transform = transforms.Compose([
            transforms.Resize(
                (IMAGE_SIZE, IMAGE_SIZE)
            ),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[
                    0.485,
                    0.456,
                    0.406,
                ],
                std=[
                    0.229,
                    0.224,
                    0.225,
                ],
            ),
        ])

        print("MobileNetV3 loaded successfully.")

    def predict(
        self,
        image: Image.Image,
    ) -> Dict[str, Any]:

        image = image.convert("RGB")

        tensor = self.transform(
            image
        ).unsqueeze(0)

        tensor = tensor.to(
            self.device
        )

        with torch.no_grad():

            outputs = self.model(
                tensor
            )

            probabilities = torch.softmax(
                outputs,
                dim=1
            )

            confidence, predicted_index = torch.max(
                probabilities,
                dim=1
            )

        class_index = predicted_index.item()

        disease = CLASS_NAMES[
            class_index
        ]

        confidence_value = confidence.item()

        probabilities_list = (
            probabilities[0]
            .detach()
            .cpu()
            .tolist()
        )

        class_probabilities = {
            CLASS_NAMES[index]:
            round(
                probabilities_list[index],
                6
            )
            for index in range(
                len(CLASS_NAMES)
            )
        }

        return {
            "disease": disease,
            "confidence": round(
                confidence_value,
                6
            ),
            "class_probabilities":
                class_probabilities,
        }


crop_disease_model = CropDiseaseModel()


def predict_sugarcane(image: Image.Image) -> Dict[str, Any]:
    return crop_disease_model.predict(image)

