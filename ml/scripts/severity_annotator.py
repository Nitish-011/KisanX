from pathlib import Path
import csv
import json
import random
import tkinter as tk
from tkinter import messagebox
from PIL import Image, ImageTk


DATASET_ROOT = Path(
    r"D:\KisanX\ml\dataset\processed\Sugarcane Leaf Disease Dataset"
)

OUTPUT_ROOT = Path(
    r"D:\KisanX\ml\dataset\severity_rgb\annotations"
)

CSV_PATH = OUTPUT_ROOT / "severity_annotations.csv"
JSON_PATH = OUTPUT_ROOT / "severity_annotations.json"

DISEASES = ["Mosaic", "RedRot", "Rust", "Yellow"]

LABELS = {
    "1": "Mild",
    "2": "Moderate",
    "3": "Moderately Severe",
    "4": "Severe",
}

IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}

PILOT_PER_DISEASE = 200

OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)


def collect_images():
    images = []

    for disease in DISEASES:
        folder = DATASET_ROOT / disease

        if not folder.exists():
            print(f"WARNING: Missing folder: {folder}")
            continue

        disease_images = [
            p for p in folder.iterdir()
            if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
        ]

        disease_images.sort()

        rng = random.Random(42)
        rng.shuffle(disease_images)

        disease_images = disease_images[:PILOT_PER_DISEASE]

        for image_path in disease_images:
            images.append({
                "path": str(image_path),
                "disease": disease,
            })

    return images


def load_annotations():
    annotations = {}

    if CSV_PATH.exists():
        try:
            with open(
                CSV_PATH,
                "r",
                newline="",
                encoding="utf-8",
            ) as f:
                reader = csv.DictReader(f)

                for row in reader:
                    annotations[row["image_path"]] = row

        except Exception as e:
            print(f"Could not read existing annotations: {e}")

    return annotations


def save_annotations(annotations):
    rows = list(annotations.values())

    with open(
        CSV_PATH,
        "w",
        newline="",
        encoding="utf-8",
    ) as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "image_path",
                "disease",
                "severity",
                "label",
            ],
        )

        writer.writeheader()
        writer.writerows(rows)

    with open(
        JSON_PATH,
        "w",
        encoding="utf-8",
    ) as f:
        json.dump(
            rows,
            f,
            indent=2,
            ensure_ascii=False,
        )


class SeverityAnnotator:

    def __init__(self, root):
        self.root = root

        self.root.title(
            "KisanX — RGB Severity Annotation"
        )

        self.root.geometry("1200x850")
        self.root.minsize(900, 700)

        self.images = collect_images()
        self.annotations = load_annotations()

        self.index = 0
        self.current_photo = None

        self.find_next_unannotated()

        self.build_ui()

        self.root.bind(
            "<KeyPress-1>",
            lambda e: self.annotate("1"),
        )
        self.root.bind(
            "<KeyPress-2>",
            lambda e: self.annotate("2"),
        )
        self.root.bind(
            "<KeyPress-3>",
            lambda e: self.annotate("3"),
        )
        self.root.bind(
            "<KeyPress-4>",
            lambda e: self.annotate("4"),
        )
        self.root.bind(
            "<KeyPress-s>",
            lambda e: self.skip(),
        )
        self.root.bind(
            "<KeyPress-S>",
            lambda e: self.skip(),
        )
        self.root.bind(
            "<KeyPress-b>",
            lambda e: self.back(),
        )
        self.root.bind(
            "<KeyPress-B>",
            lambda e: self.back(),
        )

        self.root.protocol(
            "WM_DELETE_WINDOW",
            self.close,
        )

        self.show_current()

    def build_ui(self):

        top = tk.Frame(
            self.root,
            padx=20,
            pady=15,
        )
        top.pack(fill="x")

        self.title_label = tk.Label(
            top,
            text="KISANX RGB SEVERITY ANNOTATOR",
            font=("Arial", 22, "bold"),
        )
        self.title_label.pack()

        self.info_label = tk.Label(
            top,
            text="",
            font=("Arial", 15, "bold"),
        )
        self.info_label.pack(pady=5)

        self.progress_label = tk.Label(
            top,
            text="",
            font=("Arial", 12),
        )
        self.progress_label.pack()

        self.image_frame = tk.Frame(
            self.root,
            bd=2,
            relief="groove",
        )
        self.image_frame.pack(
            fill="both",
            expand=True,
            padx=20,
            pady=10,
        )

        self.image_label = tk.Label(
            self.image_frame,
            text="Loading...",
            font=("Arial", 16),
        )
        self.image_label.pack(
            fill="both",
            expand=True,
        )

        instructions = tk.Frame(
            self.root,
            padx=20,
            pady=10,
        )
        instructions.pack(fill="x")

        tk.Label(
            instructions,
            text=(
                "1 = Mild    |    "
                "2 = Moderate    |    "
                "3 = Moderately Severe    |    "
                "4 = Severe    |    "
                "S = Skip    |    "
                "B = Back"
            ),
            font=("Arial", 13, "bold"),
        ).pack()

        rubric = (
            "Mild: few/small symptoms • "
            "Moderate: multiple clear symptoms • "
            "Moderately Severe: extensive symptoms • "
            "Severe: symptoms dominate most of the visible leaf"
        )

        tk.Label(
            instructions,
            text=rubric,
            font=("Arial", 10),
            wraplength=1100,
        ).pack(pady=5)

        button_frame = tk.Frame(
            self.root,
            pady=10,
        )
        button_frame.pack()

        buttons = [
            ("1  MILD", "1"),
            ("2  MODERATE", "2"),
            ("3  MODERATELY SEVERE", "3"),
            ("4  SEVERE", "4"),
            ("S  SKIP", "s"),
            ("B  BACK", "b"),
        ]

        for text, key in buttons:
            tk.Button(
                button_frame,
                text=text,
                font=("Arial", 11, "bold"),
                padx=12,
                pady=8,
                command=lambda k=key: self.button_action(k),
            ).pack(
                side="left",
                padx=4,
            )

    def button_action(self, key):
        if key in {"1", "2", "3", "4"}:
            self.annotate(key)

        elif key == "s":
            self.skip()

        elif key == "b":
            self.back()

    def find_next_unannotated(self):

        while self.index < len(self.images):

            path = self.images[self.index]["path"]

            if path not in self.annotations:
                break

            self.index += 1

    def show_current(self):

        if self.index >= len(self.images):
            self.finished()
            return

        item = self.images[self.index]

        path = Path(item["path"])

        self.info_label.config(
            text=f"Disease: {item['disease']}"
        )

        labeled = len(self.annotations)

        self.progress_label.config(
            text=(
                f"Image {self.index + 1} / {len(self.images)}    "
                f"|    Saved annotations: {labeled}"
            )
        )

        try:
            image = Image.open(path)
            image = image.convert("RGB")

            max_width = 1050
            max_height = 560

            image.thumbnail(
                (max_width, max_height),
                Image.Resampling.LANCZOS,
            )

            self.current_photo = ImageTk.PhotoImage(
                image
            )

            self.image_label.config(
                image=self.current_photo,
                text="",
            )

        except Exception as e:

            self.image_label.config(
                image="",
                text=f"Could not open image:\n{e}",
            )

    def annotate(self, key):

        if self.index >= len(self.images):
            return

        item = self.images[self.index]

        severity = LABELS[key]

        self.annotations[item["path"]] = {
            "image_path": item["path"],
            "disease": item["disease"],
            "severity": severity,
            "label": int(key),
        }

        save_annotations(
            self.annotations
        )

        self.index += 1

        self.find_next_unannotated()

        self.show_current()

    def skip(self):

        if self.index >= len(self.images):
            return

        item = self.images[self.index]

        self.annotations[item["path"]] = {
            "image_path": item["path"],
            "disease": item["disease"],
            "severity": "Skip",
            "label": 0,
        }

        save_annotations(
            self.annotations
        )

        self.index += 1

        self.find_next_unannotated()

        self.show_current()

    def back(self):

        if self.index <= 0:
            return

        self.index -= 1

        previous = self.images[self.index]

        if previous["path"] in self.annotations:
            del self.annotations[
                previous["path"]
            ]

            save_annotations(
                self.annotations
            )

        self.show_current()

    def finished(self):

        self.image_label.config(
            image="",
            text=(
                "🎉 PILOT COMPLETE!\n\n"
                "800 images processed.\n\n"
                f"Annotations saved to:\n"
                f"{CSV_PATH}"
            ),
            font=("Arial", 18, "bold"),
        )

        self.info_label.config(
            text="KisanX Severity Annotation Complete"
        )

        self.progress_label.config(
            text=f"Total saved: {len(self.annotations)}"
        )

    def close(self):

        save_annotations(
            self.annotations
        )

        self.root.destroy()


if __name__ == "__main__":

    print("=" * 60)
    print("KISANX RGB SEVERITY ANNOTATOR")
    print("=" * 60)

    print(f"Dataset: {DATASET_ROOT}")
    print(f"Output:  {OUTPUT_ROOT}")

    images = collect_images()

    print(f"Pilot images: {len(images)}")

    for disease in DISEASES:
        count = sum(
            1
            for x in images
            if x["disease"] == disease
        )

        print(
            f"{disease}: {count}"
        )

    print("=" * 60)

    root = tk.Tk()

    app = SeverityAnnotator(root)

    root.mainloop()
