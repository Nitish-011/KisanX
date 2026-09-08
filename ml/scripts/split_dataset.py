from pathlib import Path
import random
import shutil


SOURCE_DIR = Path(
    r"D:\KisanX\ml\dataset\processed\Sugarcane Leaf Disease Dataset"
)

OUTPUT_DIR = Path(
    r"D:\KisanX\ml\dataset\split"
)


SEED = 42


TRAIN_RATIO = 0.80
VAL_RATIO = 0.10
TEST_RATIO = 0.10

IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".JPG",
    ".JPEG",
    ".PNG",
}

CLASSES = [
    "Healthy",
    "Mosaic",
    "RedRot",
    "Rust",
    "Yellow",
]


def copy_files(files, destination):
    """Copy files into the destination directory."""
    destination.mkdir(parents=True, exist_ok=True)

    for file_path in files:
        shutil.copy2(
            file_path,
            destination / file_path.name
        )


def main():
    print("=" * 60)
    print("KisanX - Sugarcane Disease Dataset Split")
    print("=" * 60)

    if not SOURCE_DIR.exists():
        raise FileNotFoundError(
            f"Source dataset not found:\n{SOURCE_DIR}"
        )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    random.seed(SEED)

    total_images = 0

    for class_name in CLASSES:
        class_dir = SOURCE_DIR / class_name

        if not class_dir.exists():
            raise FileNotFoundError(
                f"Class folder not found:\n{class_dir}"
            )

        images = [
            file
            for file in class_dir.iterdir()
            if file.is_file()
            and file.suffix in IMAGE_EXTENSIONS
        ]

        if not images:
            raise ValueError(
                f"No images found in:\n{class_dir}"
            )

        random.shuffle(images)

        total = len(images)

        train_count = int(total * TRAIN_RATIO)
        val_count = int(total * VAL_RATIO)

        train_files = images[:train_count]
        val_files = images[
            train_count:train_count + val_count
        ]
        test_files = images[
            train_count + val_count:
        ]

        train_dir = OUTPUT_DIR / "train" / class_name
        val_dir = OUTPUT_DIR / "val" / class_name
        test_dir = OUTPUT_DIR / "test" / class_name

        copy_files(train_files, train_dir)
        copy_files(val_files, val_dir)
        copy_files(test_files, test_dir)

        print()
        print(f"{class_name}")
        print(f"  Total : {total}")
        print(f"  Train : {len(train_files)}")
        print(f"  Val   : {len(val_files)}")
        print(f"  Test  : {len(test_files)}")

        total_images += total

    print()
    print("=" * 60)
    print(f"TOTAL IMAGES: {total_images}")
    print("=" * 60)

    print()
    print("Final split verification:")

    for split in ["train", "val", "test"]:
        split_total = 0

        for class_name in CLASSES:
            folder = OUTPUT_DIR / split / class_name

            count = len([
                file
                for file in folder.iterdir()
                if file.is_file()
                and file.suffix in IMAGE_EXTENSIONS
            ])

            split_total += count

            print(
                f"{split:5} | "
                f"{class_name:7} | "
                f"{count}"
            )

        print(f"{split:5} | TOTAL   | {split_total}")
        print("-" * 40)

    print()
    print("Dataset split completed successfully.")
    print(f"Output: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
