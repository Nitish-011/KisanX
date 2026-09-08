import os
from typing import Any, Dict, List

from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from supabase import create_client


BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

load_dotenv(
    os.path.join(
        BASE_DIR,
        ".env",
    )
)


SUPABASE_URL = os.getenv(
    "SUPABASE_URL",
    "",
).strip()

SUPABASE_SECRET_KEY = os.getenv(
    "SUPABASE_SECRET_KEY",
    "",
).strip()

if not SUPABASE_SECRET_KEY:
    SUPABASE_SECRET_KEY = os.getenv(
        "SUPABASE_SERVICE_ROLE_KEY",
        "",
    ).strip()


if not SUPABASE_URL:
    raise RuntimeError(
        "SUPABASE_URL is not configured."
    )

if not SUPABASE_SECRET_KEY:
    raise RuntimeError(
        "SUPABASE_SECRET_KEY or "
        "SUPABASE_SERVICE_ROLE_KEY is not configured."
    )


supabase = create_client(
    SUPABASE_URL,
    SUPABASE_SECRET_KEY,
)


print("=" * 70)
print("Loading KisanX embedding model...")
print("Model: sentence-transformers/all-MiniLM-L6-v2")
print("=" * 70)

embedding_model = SentenceTransformer(
    "sentence-transformers/all-MiniLM-L6-v2"
)

print("Embedding model loaded.")
print()


KNOWLEDGE_RECORDS: List[Dict[str, Any]] = [


    {
        "title": "Sugarcane Red Rot: disease symptoms and identification",
        "source_name": "ICAR",
        "source_url": (
            "https://icar.gov.in/sites/default/files/"
            "2022-04/ICAR-News-October-December-2018.pdf"
        ),
        "crop": "Sugarcane",
        "disease": "RedRot",
        "language": "en",
        "content": (
            "Red rot is an important disease of sugarcane. "
            "Symptoms can be observed in affected stalks and leaves. "
            "The disease can cause serious damage to sugarcane crops. "
            "Field inspection should include checking plants for "
            "characteristic disease symptoms and removing clearly "
            "infected plants from the field."
        ),
        "metadata": {
            "crop": "Sugarcane",
            "disease": "RedRot",
            "topic": "identification",
            "authority": "ICAR",
        },
    },

    {
        "title": "Sugarcane Red Rot: affected plants and field sanitation",
        "source_name": "ICAR",
        "source_url": (
            "https://icar.gov.in/sites/default/files/"
            "Circulars/ICAR-En-Kharif-Agro-Advisories-for-Farmers-2025.pdf"
        ),
        "crop": "Sugarcane",
        "disease": "RedRot",
        "language": "en",
        "content": (
            "For management of red rot in sugarcane, affected plants "
            "should be identified and removed from the field. "
            "Field sanitation and use of healthy planting material "
            "are important parts of disease management. "
            "Farmers should avoid using visibly diseased material "
            "for further planting."
        ),
        "metadata": {
            "crop": "Sugarcane",
            "disease": "RedRot",
            "topic": "management",
            "authority": "ICAR",
        },
    },

    {
        "title": "Sugarcane Red Rot: healthy planting material",
        "source_name": "ICAR",
        "source_url": (
            "https://icar.gov.in/en/farmers-participatory-quality-seed-"
            "production-sugarcane-organised"
        ),
        "crop": "Sugarcane",
        "disease": "RedRot",
        "language": "en",
        "content": (
            "Use of healthy and quality planting material is important "
            "for reducing disease problems in sugarcane. "
            "Farmers should select healthy planting material and avoid "
            "planting material showing disease symptoms. "
            "Quality seed production and healthy planting material "
            "support better crop establishment."
        ),
        "metadata": {
            "crop": "Sugarcane",
            "disease": "RedRot",
            "topic": "prevention",
            "authority": "ICAR",
        },
    },

    {
        "title": "Sugarcane Red Rot: water management and disease risk",
        "source_name": "ICAR",
        "source_url": (
            "https://icar.gov.in/sites/default/files/"
            "Circulars/ICAR-En-Kharif-Agro-Advisories-for-Farmers-2025.pdf"
        ),
        "crop": "Sugarcane",
        "disease": "RedRot",
        "language": "en",
        "content": (
            "Sugarcane disease management should include appropriate "
            "field and water management. Excess water and poor drainage "
            "can create conditions that are unfavorable for crop health. "
            "Farmers should inspect fields where water remains standing "
            "and maintain suitable drainage."
        ),
        "metadata": {
            "crop": "Sugarcane",
            "disease": "RedRot",
            "topic": "field-management",
            "authority": "ICAR",
        },
    },

    {
        "title": "Sugarcane Red Rot: ratoon crop management",
        "source_name": "ICAR",
        "source_url": (
            "https://icar.gov.in/sites/default/files/"
            "Circulars/ICAR-En-Kharif-Agro-Advisories-for-Farmers-2025.pdf"
        ),
        "crop": "Sugarcane",
        "disease": "RedRot",
        "language": "en",
        "content": (
            "Red rot management includes careful selection of healthy "
            "planting material and removal of affected plants. "
            "Fields with disease problems should be inspected carefully "
            "before continuing crop production. "
            "Farmers should follow recommended crop management practices "
            "for their local conditions and avoid carrying visibly "
            "diseased material into a new crop."
        ),
        "metadata": {
            "crop": "Sugarcane",
            "disease": "RedRot",
            "topic": "crop-management",
            "authority": "ICAR",
        },
    },



    {
        "title": "Sugarcane Mosaic: cause and symptoms",
        "source_name": "ICAR",
        "source_url": (
            "https://icar.gov.in/sites/default/files/"
            "2022-04/ICAR-News-October-December-2018.pdf"
        ),
        "crop": "Sugarcane",
        "disease": "Mosaic",
        "language": "en",
        "content": (
            "Sugarcane mosaic is associated with sugarcane mosaic "
            "viruses, including Sugarcane mosaic virus and Sugarcane "
            "streak mosaic virus. The disease produces mosaic-type "
            "patterns on leaves. Farmers should inspect leaves for "
            "characteristic mosaic symptoms and identify affected "
            "plants early."
        ),
        "metadata": {
            "crop": "Sugarcane",
            "disease": "Mosaic",
            "topic": "identification",
            "authority": "ICAR",
        },
    },

    {
        "title": "Sugarcane Mosaic: prevention through healthy planting material",
        "source_name": "ICAR",
        "source_url": (
            "https://icar.gov.in/sites/default/files/"
            "2022-04/ICAR-News-October-December-2018.pdf"
        ),
        "crop": "Sugarcane",
        "disease": "Mosaic",
        "language": "en",
        "content": (
            "Management of sugarcane viral diseases should emphasize "
            "healthy planting material. Disease-free planting material, "
            "including material produced through suitable tissue-culture "
            "and virus-indexing approaches, can help reduce the risk of "
            "introducing viral diseases into a crop. Farmers should "
            "avoid visibly diseased planting material."
        ),
        "metadata": {
            "crop": "Sugarcane",
            "disease": "Mosaic",
            "topic": "prevention",
            "authority": "ICAR",
        },
    },



    {
        "title": "Sugarcane Yellow Leaf Disease: symptoms",
        "source_name": "ICAR",
        "source_url": (
            "https://icar.gov.in/sites/default/files/"
            "2022-04/ICAR-News-October-December-2018.pdf"
        ),
        "crop": "Sugarcane",
        "disease": "Yellow",
        "language": "en",
        "content": (
            "Sugarcane yellow leaf disease is associated with "
            "Sugarcane yellow leaf virus. A characteristic symptom "
            "is yellowing along the midrib of leaves, particularly "
            "visible in the whorl. Farmers should inspect the leaves "
            "and midrib area when checking for possible yellow leaf "
            "disease."
        ),
        "metadata": {
            "crop": "Sugarcane",
            "disease": "Yellow",
            "topic": "identification",
            "authority": "ICAR",
        },
    },

    {
        "title": "Sugarcane Yellow Leaf Disease: planting material and transmission",
        "source_name": "ICAR",
        "source_url": (
            "https://icar.gov.in/sites/default/files/"
            "2022-04/ICAR-News-October-December-2018.pdf"
        ),
        "crop": "Sugarcane",
        "disease": "Yellow",
        "language": "en",
        "content": (
            "Sugarcane yellow leaf disease is associated with "
            "Sugarcane yellow leaf virus. The disease can be associated "
            "with infected planting material, and sugarcane aphids are "
            "also associated with virus transmission. Use of healthy "
            "planting material and appropriate disease monitoring are "
            "important preventive practices."
        ),
        "metadata": {
            "crop": "Sugarcane",
            "disease": "Yellow",
            "topic": "prevention",
            "authority": "ICAR",
        },
    },



    {
        "title": "Sugarcane Rust: identification and symptoms",
        "source_name": "ICAR",
        "source_url": (
            "https://icar.gov.in/sites/default/files/"
            "Circulars/ICAR-En-Kharif-Agro-Advisories-for-Farmers-2025.pdf"
        ),
        "crop": "Sugarcane",
        "disease": "Rust",
        "language": "en",
        "content": (
            "Sugarcane rust can be identified by characteristic "
            "rust-colored pustules on leaves. Farmers should inspect "
            "sugarcane leaves regularly for the appearance and "
            "development of rust pustules. Early recognition supports "
            "timely disease management."
        ),
        "metadata": {
            "crop": "Sugarcane",
            "disease": "Rust",
            "topic": "identification",
            "authority": "ICAR",
        },
    },

    {
        "title": "Sugarcane Rust: ICAR management guidance",
        "source_name": "ICAR",
        "source_url": (
            "https://icar.gov.in/sites/default/files/"
            "Circulars/ICAR-En-Kharif-Agro-Advisories-for-Farmers-2025.pdf"
        ),
        "crop": "Sugarcane",
        "disease": "Rust",
        "language": "en",
        "content": (
            "ICAR farmer advisories describe management of sugarcane "
            "rust after the appearance of pustules and include foliar "
            "fungicide management as part of the advisory. "
            "The exact product, concentration, dose, application "
            "interval, and local regulatory requirements should be "
            "verified from the current official recommendation before "
            "any chemical application."
        ),
        "metadata": {
            "crop": "Sugarcane",
            "disease": "Rust",
            "topic": "management",
            "authority": "ICAR",
        },
    },
]


EXPECTED_COUNTS = {
    "RedRot": 5,
    "Mosaic": 2,
    "Yellow": 2,
    "Rust": 2,
}


def validate_records() -> None:

    if len(KNOWLEDGE_RECORDS) != 11:
        raise RuntimeError(
            f"Expected 11 records, "
            f"found {len(KNOWLEDGE_RECORDS)}."
        )

    counts: Dict[str, int] = {}

    for record in KNOWLEDGE_RECORDS:

        required = [
            "title",
            "source_name",
            "source_url",
            "crop",
            "disease",
            "language",
            "content",
            "metadata",
        ]

        for field in required:

            if field not in record:

                raise RuntimeError(
                    f"Missing '{field}' in "
                    f"{record.get('title', 'UNKNOWN')}"
                )

        disease = record["disease"]

        counts[disease] = (
            counts.get(disease, 0) + 1
        )

    if counts != EXPECTED_COUNTS:

        raise RuntimeError(
            f"Incorrect disease counts.\n"
            f"Expected: {EXPECTED_COUNTS}\n"
            f"Found: {counts}"
        )


def build_embedding_text(
    record: Dict[str, Any],
) -> str:

    return "\n".join(
        [
            f"Title: {record['title']}",
            f"Crop: {record['crop']}",
            f"Disease: {record['disease']}",
            f"Topic: {record['metadata'].get('topic', '')}",
            f"Content: {record['content']}",
        ]
    )


def create_embedding(
    text: str,
) -> List[float]:

    embedding = embedding_model.encode(
        text,
        normalize_embeddings=True,
    )

    return embedding.tolist()


def main() -> None:

    print("=" * 70)
    print("KISANX KNOWLEDGE BASE SEED")
    print("=" * 70)

    validate_records()

    print(
        "Validated 11 canonical knowledge records."
    )

    print()

    prepared_records = []

    for index, record in enumerate(
        KNOWLEDGE_RECORDS,
        start=1,
    ):

        print(
            f"[{index}/11] "
            f"Creating embedding: "
            f"{record['title']}"
        )

        embedding_text = build_embedding_text(
            record
        )

        embedding = create_embedding(
            embedding_text
        )

        prepared_records.append(
            {
                **record,
                "embedding": embedding,
            }
        )

    print()
    print("Embeddings generated.")
    print()

    print(
        "Upserting records into Supabase..."
    )

    response = (
        supabase
        .table("knowledge_documents")
        .upsert(
            prepared_records,
            on_conflict=(
                "title,"
                "source_name,"
                "source_url,"
                "disease,"
                "language"
            ),
        )
        .execute()
    )

    processed = response.data or []

    print()
    print("=" * 70)
    print("SEED COMPLETE")
    print("=" * 70)

    print(
        f"Records processed: {len(processed)}"
    )

    print()

    for disease, count in EXPECTED_COUNTS.items():

        print(
            f"{disease:<10} {count} records"
        )

    print()
    print(
        "This seed is idempotent."
    )

    print(
        "Running it again will not create duplicates."
    )

    print("=" * 70)


if __name__ == "__main__":
    try:
        from seed_multi_crop_knowledge import main as multi_crop_main
    except ImportError:
        from scripts.seed_multi_crop_knowledge import main as multi_crop_main
    multi_crop_main()
