from pathlib import Path
from typing import Dict, Any

import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms

from app.config import settings


MODEL_PATH = (
    Path(settings.model_dir)
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

        self.mock_mode = False
        if not MODEL_PATH.exists():
            print(f"WARNING: MobileNetV3 model not found at {MODEL_PATH}")
            print("Running in MOCK mode. Will return stub predictions.")
            self.mock_mode = True
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

        if getattr(self, "mock_mode", False):
            import random
            # Just return a random disease for testing backend workflows
            disease = random.choice([c for c in CLASS_NAMES if c != "Healthy"])
            return {
                "disease": disease,
                "confidence": 0.92,
                "class_probabilities": {name: (0.92 if name == disease else 0.02) for name in CLASS_NAMES}
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


crop_disease_model = CropDiseaseModel()