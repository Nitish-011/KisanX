from pathlib import Path
from typing import Dict, Any

import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms


from app.config import settings

MODEL_PATH = settings.sugarcane_model_path

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

        self.is_mock = not MODEL_PATH.exists()

        if self.is_mock:
            print("=" * 60)
            print(f"[WARNING] MobileNetV3 weights not found at:\n{MODEL_PATH}")
            print("Running in simulated inference mode for local development/testing.")
            print("=" * 60)
            self.model = None
            return

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

        if getattr(self, "is_mock", False):
            return {
                "disease": "Healthy",
                "confidence": 0.942,
                "class_probabilities": {
                    "Healthy": 0.942,
                    "Mosaic": 0.021,
                    "RedRot": 0.015,
                    "Rust": 0.012,
                    "Yellow": 0.010,
                },
            }

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


_model_instance = None

def get_model() -> CropDiseaseModel:
    global _model_instance
    if _model_instance is None:
        _model_instance = CropDiseaseModel()
    return _model_instance

def predict_sugarcane(image: Image.Image) -> Dict[str, Any]:
    return get_model().predict(image)

predict_sugarcane_disease = predict_sugarcane

class _CropDiseaseModelProxy:
    def predict(self, image: Image.Image) -> Dict[str, Any]:
        return predict_sugarcane(image)

crop_disease_model = _CropDiseaseModelProxy()

