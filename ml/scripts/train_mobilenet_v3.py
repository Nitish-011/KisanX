from pathlib import Path
import copy
import json
import time

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
)
from torch.cuda.amp import GradScaler, autocast
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms


PROJECT_ROOT = Path(r"D:\KisanX")

DATASET_DIR = PROJECT_ROOT / "ml" / "dataset" / "split"

TRAIN_DIR = DATASET_DIR / "train"
VAL_DIR = DATASET_DIR / "val"
TEST_DIR = DATASET_DIR / "test"

MODEL_DIR = PROJECT_ROOT / "ml" / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

BEST_MODEL_PATH = MODEL_DIR / "mobilenet_v3_large_best.pth"
FINAL_MODEL_PATH = MODEL_DIR / "mobilenet_v3_large_final.pth"
METRICS_PATH = MODEL_DIR / "mobilenet_v3_metrics.json"


IMAGE_SIZE = 224

BATCH_SIZE = 32

NUM_EPOCHS = 30

LEARNING_RATE = 0.0003

WEIGHT_DECAY = 0.0001

NUM_WORKERS = 0

SEED = 42

PATIENCE = 7


torch.manual_seed(SEED)

if torch.cuda.is_available():
    torch.cuda.manual_seed_all(SEED)

np.random.seed(SEED)


DEVICE = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)


CLASS_NAMES = [
    "Healthy",
    "Mosaic",
    "RedRot",
    "Rust",
    "Yellow",
]


def verify_dataset():
    """Verify that all required folders exist."""

    required_dirs = [
        TRAIN_DIR,
        VAL_DIR,
        TEST_DIR,
    ]

    for directory in required_dirs:
        if not directory.exists():
            raise FileNotFoundError(
                f"Dataset directory not found:\n{directory}"
            )

    for split_dir in required_dirs:
        for class_name in CLASS_NAMES:
            class_dir = split_dir / class_name

            if not class_dir.exists():
                raise FileNotFoundError(
                    f"Missing class directory:\n{class_dir}"
                )


def count_dataset(dataset):
    return len(dataset)


def save_json(data, path):
    with open(
        path,
        "w",
        encoding="utf-8"
    ) as file:
        json.dump(
            data,
            file,
            indent=4
        )


def main():

    print("=" * 70)
    print("KISANX - MobileNetV3-Large")
    print("Sugarcane Leaf Disease Classification")
    print("=" * 70)

    verify_dataset()

    print()
    print("Device:")
    print(DEVICE)

    if torch.cuda.is_available():

        print(
            "GPU:",
            torch.cuda.get_device_name(0)
        )

        print(
            "VRAM:",
            round(
                torch.cuda.get_device_properties(0)
                .total_memory / (1024 ** 3),
                2
            ),
            "GB"
        )

    else:

        print("WARNING: CUDA is not available.")

    print()

    train_transform = transforms.Compose([
        transforms.Resize(
            (IMAGE_SIZE, IMAGE_SIZE)
        ),

        transforms.RandomHorizontalFlip(
            p=0.5
        ),

        transforms.RandomVerticalFlip(
            p=0.15
        ),

        transforms.RandomRotation(
            degrees=15
        ),

        transforms.ColorJitter(
            brightness=0.20,
            contrast=0.20,
            saturation=0.15,
            hue=0.03
        ),

        transforms.ToTensor(),

        transforms.Normalize(
            mean=[
                0.485,
                0.456,
                0.406
            ],
            std=[
                0.229,
                0.224,
                0.225
            ]
        ),
    ])

    eval_transform = transforms.Compose([
        transforms.Resize(
            (IMAGE_SIZE, IMAGE_SIZE)
        ),

        transforms.ToTensor(),

        transforms.Normalize(
            mean=[
                0.485,
                0.456,
                0.406
            ],
            std=[
                0.229,
                0.224,
                0.225
            ]
        ),
    ])

    print("Loading datasets...")

    train_dataset = datasets.ImageFolder(
        TRAIN_DIR,
        transform=train_transform
    )

    val_dataset = datasets.ImageFolder(
        VAL_DIR,
        transform=eval_transform
    )

    test_dataset = datasets.ImageFolder(
        TEST_DIR,
        transform=eval_transform
    )

    print()
    print("Dataset sizes:")
    print("Train:", len(train_dataset))
    print("Validation:", len(val_dataset))
    print("Test:", len(test_dataset))
    print(
        "Total:",
        len(train_dataset)
        + len(val_dataset)
        + len(test_dataset)
    )

    print()
    print("Class mapping:")

    print(train_dataset.class_to_idx)

    expected_mapping = {
        "Healthy": 0,
        "Mosaic": 1,
        "RedRot": 2,
        "Rust": 3,
        "Yellow": 4,
    }

    if train_dataset.class_to_idx != expected_mapping:

        raise ValueError(
            "Unexpected class mapping.\n"
            f"Expected: {expected_mapping}\n"
            f"Found: {train_dataset.class_to_idx}"
        )

    train_loader = DataLoader(
        train_dataset,
        batch_size=BATCH_SIZE,
        shuffle=True,
        num_workers=NUM_WORKERS,
        pin_memory=torch.cuda.is_available(),
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=BATCH_SIZE,
        shuffle=False,
        num_workers=NUM_WORKERS,
        pin_memory=torch.cuda.is_available(),
    )

    test_loader = DataLoader(
        test_dataset,
        batch_size=BATCH_SIZE,
        shuffle=False,
        num_workers=NUM_WORKERS,
        pin_memory=torch.cuda.is_available(),
    )

    print()
    print("Loading pretrained MobileNetV3-Large...")

    weights = models.MobileNet_V3_Large_Weights.DEFAULT

    model = models.mobilenet_v3_large(
        weights=weights
    )

    in_features = model.classifier[-1].in_features

    model.classifier[-1] = nn.Linear(
        in_features,
        len(CLASS_NAMES)
    )

    model = model.to(DEVICE)

    criterion = nn.CrossEntropyLoss()

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=LEARNING_RATE,
        weight_decay=WEIGHT_DECAY
    )

    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer,
        mode="min",
        factor=0.3,
        patience=2
    )

    use_amp = DEVICE.type == "cuda"

    scaler = GradScaler(
        enabled=use_amp
    )

    history = {
        "train_loss": [],
        "train_accuracy": [],
        "val_loss": [],
        "val_accuracy": [],
        "learning_rate": [],
    }

    best_val_accuracy = 0.0

    best_model_weights = copy.deepcopy(
        model.state_dict()
    )

    epochs_without_improvement = 0

    print()
    print("=" * 70)
    print("STARTING TRAINING")
    print("=" * 70)

    total_start_time = time.time()

    for epoch in range(NUM_EPOCHS):

        epoch_start_time = time.time()

        model.train()

        running_loss = 0.0
        correct = 0
        total = 0

        for images, labels in train_loader:

            images = images.to(
                DEVICE,
                non_blocking=True
            )

            labels = labels.to(
                DEVICE,
                non_blocking=True
            )

            optimizer.zero_grad(
                set_to_none=True
            )

            with autocast(
                enabled=use_amp
            ):

                outputs = model(images)

                loss = criterion(
                    outputs,
                    labels
                )

            scaler.scale(loss).backward()

            scaler.step(optimizer)

            scaler.update()

            running_loss += (
                loss.item()
                * images.size(0)
            )

            predictions = torch.argmax(
                outputs,
                dim=1
            )

            correct += (
                predictions == labels
            ).sum().item()

            total += labels.size(0)

        train_loss = (
            running_loss / total
        )

        train_accuracy = (
            correct / total
        )

        model.eval()

        val_running_loss = 0.0
        val_correct = 0
        val_total = 0

        with torch.no_grad():

            for images, labels in val_loader:

                images = images.to(
                    DEVICE,
                    non_blocking=True
                )

                labels = labels.to(
                    DEVICE,
                    non_blocking=True
                )

                with autocast(
                    enabled=use_amp
                ):

                    outputs = model(images)

                    loss = criterion(
                        outputs,
                        labels
                    )

                val_running_loss += (
                    loss.item()
                    * images.size(0)
                )

                predictions = torch.argmax(
                    outputs,
                    dim=1
                )

                val_correct += (
                    predictions == labels
                ).sum().item()

                val_total += labels.size(0)

        val_loss = (
            val_running_loss / val_total
        )

        val_accuracy = (
            val_correct / val_total
        )

        scheduler.step(val_loss)

        current_lr = optimizer.param_groups[0]["lr"]

        history["train_loss"].append(
            train_loss
        )

        history["train_accuracy"].append(
            train_accuracy
        )

        history["val_loss"].append(
            val_loss
        )

        history["val_accuracy"].append(
            val_accuracy
        )

        history["learning_rate"].append(
            current_lr
        )

        epoch_time = (
            time.time()
            - epoch_start_time
        )

        print()

        print(
            f"Epoch "
            f"{epoch + 1:02d}/{NUM_EPOCHS} | "
            f"Train Loss: {train_loss:.4f} | "
            f"Train Acc: {train_accuracy * 100:.2f}% | "
            f"Val Loss: {val_loss:.4f} | "
            f"Val Acc: {val_accuracy * 100:.2f}% | "
            f"LR: {current_lr:.6f} | "
            f"Time: {epoch_time:.1f}s"
        )

        if val_accuracy > best_val_accuracy:

            best_val_accuracy = val_accuracy

            best_model_weights = copy.deepcopy(
                model.state_dict()
            )

            torch.save(
                {
                    "model_name": "MobileNetV3-Large",
                    "num_classes": len(CLASS_NAMES),
                    "class_names": CLASS_NAMES,
                    "image_size": IMAGE_SIZE,
                    "state_dict": model.state_dict(),
                    "val_accuracy": val_accuracy,
                    "epoch": epoch + 1,
                },
                BEST_MODEL_PATH
            )

            epochs_without_improvement = 0

            print(
                f"  ✓ New best model saved "
                f"({val_accuracy * 100:.2f}%)"
            )

        else:

            epochs_without_improvement += 1

            print(
                f"  No improvement "
                f"({epochs_without_improvement}/{PATIENCE})"
            )

        if epochs_without_improvement >= PATIENCE:

            print()
            print(
                "Early stopping triggered."
            )

            break

    total_training_time = (
        time.time()
        - total_start_time
    )

    model.load_state_dict(
        best_model_weights
    )

    print()
    print("=" * 70)
    print("FINAL TEST EVALUATION")
    print("=" * 70)

    model.eval()

    all_labels = []
    all_predictions = []

    with torch.no_grad():

        for images, labels in test_loader:

            images = images.to(
                DEVICE,
                non_blocking=True
            )

            with autocast(
                enabled=use_amp
            ):

                outputs = model(images)

            predictions = torch.argmax(
                outputs,
                dim=1
            )

            all_labels.extend(
                labels.numpy()
            )

            all_predictions.extend(
                predictions.cpu().numpy()
            )

    test_accuracy = accuracy_score(
        all_labels,
        all_predictions
    )

    report = classification_report(
        all_labels,
        all_predictions,
        target_names=CLASS_NAMES,
        output_dict=True,
        zero_division=0
    )

    print()

    print(
        classification_report(
            all_labels,
            all_predictions,
            target_names=CLASS_NAMES,
            zero_division=0
        )
    )

    cm = confusion_matrix(
        all_labels,
        all_predictions
    )

    print("Confusion Matrix:")

    print()

    print(
        "             "
        + " ".join(
            f"{name[:7]:>8}"
            for name in CLASS_NAMES
        )
    )

    for name, row in zip(
        CLASS_NAMES,
        cm
    ):

        print(
            f"{name[:10]:>10} "
            + " ".join(
                f"{value:>8}"
                for value in row
            )
        )

    torch.save(
        {
            "model_name": "MobileNetV3-Large",
            "num_classes": len(CLASS_NAMES),
            "class_names": CLASS_NAMES,
            "image_size": IMAGE_SIZE,
            "state_dict": model.state_dict(),
            "test_accuracy": test_accuracy,
            "best_val_accuracy": best_val_accuracy,
        },
        FINAL_MODEL_PATH
    )

    metrics = {
        "model": "MobileNetV3-Large",

        "dataset": {
            "total": 2521,
            "train": len(train_dataset),
            "validation": len(val_dataset),
            "test": len(test_dataset),
        },

        "classes": CLASS_NAMES,

        "best_validation_accuracy":
            best_val_accuracy,

        "test_accuracy":
            test_accuracy,

        "classification_report":
            report,

        "confusion_matrix":
            cm.tolist(),

        "training": {
            "epochs_requested":
                NUM_EPOCHS,

            "epochs_completed":
                len(history["train_loss"]),

            "batch_size":
                BATCH_SIZE,

            "learning_rate":
                LEARNING_RATE,

            "weight_decay":
                WEIGHT_DECAY,

            "image_size":
                IMAGE_SIZE,

            "seed":
                SEED,

            "training_time_seconds":
                total_training_time,
        },

        "device":
            str(DEVICE),

        "gpu":
            (
                torch.cuda.get_device_name(0)
                if torch.cuda.is_available()
                else "CPU"
        ),

        "history":
            history,
    }

    save_json(
        metrics,
        METRICS_PATH
    )

    print()
    print("=" * 70)
    print("TRAINING COMPLETE")
    print("=" * 70)

    print(
        f"Best validation accuracy: "
        f"{best_val_accuracy * 100:.2f}%"
    )

    print(
        f"Final test accuracy: "
        f"{test_accuracy * 100:.2f}%"
    )

    print()
    print("Saved files:")

    print(
        f"Best model : {BEST_MODEL_PATH}"
    )

    print(
        f"Final model: {FINAL_MODEL_PATH}"
    )

    print(
        f"Metrics    : {METRICS_PATH}"
    )

    print()
    print(
        f"Training time: "
        f"{total_training_time / 60:.2f} minutes"
    )

    print("=" * 70)


if __name__ == "__main__":
    main()
