# Project Code Export

## File: backend/app/routes/scans.py

`py
from io import BytesIO
from typing import Optional
from uuid import uuid4

from fastapi import (
    APIRouter,
    File,
    Form,
    Header,
    HTTPException,
    UploadFile,
)
from PIL import Image

from app.config import settings
from app.services.crop_disease_model import crop_disease_model
from app.services.crop_advisory_service import (
    generate_crop_advisory,
)
from app.services.supabase_service import (
    get_server_supabase,
)


router = APIRouter(
    prefix="/api/scans",
    tags=["Scans"],
)


MAX_FILE_SIZE = 10 * 1024 * 1024

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}

ALLOWED_EXTENSIONS = {
    "jpg",
    "jpeg",
    "png",
    "webp",
}

STORAGE_BUCKET = "crop-scans"


def extract_bearer_token(
    authorization: Optional[str],
) -> str:

    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authorization header is required.",
        )

    parts = authorization.strip().split()

    if len(parts) != 2:
        raise HTTPException(
            status_code=401,
            detail="Invalid Authorization header.",
        )

    scheme, token = parts

    if scheme.lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Authorization must use Bearer token.",
        )

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Bearer token is missing.",
        )

    return token


def get_authenticated_user(
    authorization: Optional[str],
):
    """
    Validate the Supabase access token using the
    Supabase publishable key.

    Server-side database and storage operations use
    the secret key through get_server_supabase().
    """

    token = extract_bearer_token(
        authorization
    )

    try:
        from supabase import create_client

        if not settings.supabase_url:
            raise RuntimeError(
                "SUPABASE_URL is not configured."
            )

        if not settings.supabase_publishable_key:
            raise RuntimeError(
                "SUPABASE_PUBLISHABLE_KEY is not configured."
            )

        auth_client = create_client(
            settings.supabase_url,
            settings.supabase_publishable_key,
        )

        response = auth_client.auth.get_user(
            token
        )

        user = response.user

        if user is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired access token.",
            )

        return user

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=401,
            detail=(
                "Authentication failed: "
                f"{str(exc)}"
            ),
        )


def resolve_scan_context(
    owner_id: str,
    farm_id: Optional[str],
    plot_id: Optional[str],
) -> tuple[str, Optional[str], Optional[str]]:
    """
    Resolve and validate the farm, plot, and active crop cycle
    for a scan.

    The farmer only selects the farm and plot.

    KisanX automatically finds the ACTIVE crop cycle belonging
    to that plot.
    """

    if not farm_id:
        raise HTTPException(
            status_code=400,
            detail="Farm is required for a crop scan.",
        )

    if not plot_id:
        raise HTTPException(
            status_code=400,
            detail="Plot is required for a crop scan.",
        )

    supabase = get_server_supabase()

    try:
        farm_response = (
            supabase
            .table("farms")
            .select("id")
            .eq("id", farm_id)
            .eq("owner_id", owner_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to verify farm: "
                f"{str(exc)}"
            ),
        )

    farm_data = farm_response.data or []

    if not farm_data:
        raise HTTPException(
            status_code=404,
            detail=(
                "The selected farm was not found "
                "or does not belong to your account."
            ),
        )

    try:
        plot_response = (
            supabase
            .table("plots")
            .select("id, farm_id")
            .eq("id", plot_id)
            .eq("farm_id", farm_id)
            .eq("owner_id", owner_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to verify plot: "
                f"{str(exc)}"
            ),
        )

    plot_data = plot_response.data or []

    if not plot_data:
        raise HTTPException(
            status_code=404,
            detail=(
                "The selected plot was not found "
                "or does not belong to the selected farm."
            ),
        )

    try:
        crop_cycle_response = (
            supabase
            .table("crop_cycles")
            .select(
                "id, plot_id, crop_name, variety, "
                "crop_stage, planting_date, soil_type, status"
            )
            .eq("plot_id", plot_id)
            .eq("owner_id", owner_id)
            .eq("status", "ACTIVE")
            .order(
                "created_at",
                desc=True,
            )
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to resolve active crop cycle: "
                f"{str(exc)}"
            ),
        )

    crop_cycle_data = (
        crop_cycle_response.data or []
    )

    if not crop_cycle_data:
        raise HTTPException(
            status_code=409,
            detail=(
                "No active crop cycle was found for "
                "this plot. Please register an active "
                "sugarcane crop cycle before scanning."
            ),
        )

    crop_cycle = crop_cycle_data[0]

    crop_cycle_id = crop_cycle.get("id")

    if not crop_cycle_id:
        raise HTTPException(
            status_code=500,
            detail=(
                "The active crop cycle is missing its ID."
            ),
        )

    return (
        farm_id,
        plot_id,
        crop_cycle_id,
    )


async def read_and_validate_image(
    file: UploadFile,
) -> tuple[bytes, Image.Image, str]:

    if not file:
        raise HTTPException(
            status_code=400,
            detail="Image file is required.",
        )

    content_type = (
        file.content_type or ""
    ).lower()

    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported image format. "
                "Use JPG, JPEG, PNG, or WEBP."
            ),
        )

    filename = file.filename or "scan.jpg"

    extension = (
        filename.rsplit(".", 1)[-1].lower()
        if "." in filename
        else ""
    )

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file extension. "
                "Use JPG, JPEG, PNG, or WEBP."
            ),
        )

    image_bytes = await file.read()

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty.",
        )

    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Image size must not exceed 10 MB.",
        )

    try:
        image = Image.open(
            BytesIO(image_bytes)
        )

        image.verify()

        image = Image.open(
            BytesIO(image_bytes)
        ).convert("RGB")

    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is not a valid image.",
        )

    return (
        image_bytes,
        image,
        extension,
    )


def run_disease_prediction(
    image: Image.Image,
):
    """
    Run the trained MobileNetV3 disease classifier.

    Expected result:

    {
        "disease": "...",
        "confidence": 0.99,
        "class_probabilities": {...},
        ...
    }
    """

    try:
        prediction = (
            crop_disease_model.predict(
                image
            )
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Disease model inference failed: "
                f"{str(exc)}"
            ),
        )

    if not isinstance(
        prediction,
        dict,
    ):
        raise HTTPException(
            status_code=500,
            detail=(
                "Disease model returned an "
                "invalid prediction."
            ),
        )

    disease = prediction.get(
        "disease"
    )

    confidence = prediction.get(
        "confidence"
    )

    if not disease:
        raise HTTPException(
            status_code=500,
            detail=(
                "Disease model did not return "
                "a disease prediction."
            ),
        )

    try:
        confidence = float(
            confidence
        )

    except (
        TypeError,
        ValueError,
    ):
        raise HTTPException(
            status_code=500,
            detail=(
                "Disease model returned "
                "an invalid confidence."
            ),
        )

    prediction["confidence"] = confidence

    return prediction


def upload_scan_image(
    image_bytes: bytes,
    extension: str,
    owner_id: str,
) -> str:

    supabase = get_server_supabase()

    scan_uuid = uuid4()

    storage_path = (
        f"{owner_id}/"
        f"{scan_uuid.hex}."
        f"{extension}"
    )

    try:
        supabase.storage.from_(
            STORAGE_BUCKET
        ).upload(
            storage_path,
            image_bytes,
            {
                "content-type": (
                    f"image/{extension}"
                    if extension != "jpg"
                    else "image/jpeg"
                ),
                "upsert": False,
            },
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to upload scan image "
                "to Supabase Storage: "
                f"{str(exc)}"
            ),
        )

    return storage_path


def save_scan(
    owner_id: str,
    farm_id: Optional[str],
    plot_id: Optional[str],
    crop_cycle_id: Optional[str],
    image_url: str,
    prediction: dict,
    latitude: Optional[float],
    longitude: Optional[float],
):

    supabase = get_server_supabase()

    row = {
        "owner_id": owner_id,
        "farm_id": farm_id,
        "plot_id": plot_id,
        "crop_cycle_id": crop_cycle_id,
        "image_url": image_url,
        "disease": prediction.get(
            "disease"
        ),
        "confidence": prediction.get(
            "confidence"
        ),


        "severity": None,

        "latitude": latitude,
        "longitude": longitude,
    }

    try:
        response = (
            supabase
            .table("crop_scans")
            .insert(row)
            .execute()
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to save crop scan: "
                f"{str(exc)}"
            ),
        )

    data = response.data or []

    if not data:
        raise HTTPException(
            status_code=500,
            detail=(
                "Crop scan was not saved "
                "by the database."
            ),
        )

    return data[0]


@router.post("/create")
async def create_scan(
    file: UploadFile = File(...),

    farm_id: Optional[str] = Form(
        default=None
    ),

    plot_id: Optional[str] = Form(
        default=None
    ),


    crop_cycle_id: Optional[str] = Form(
        default=None
    ),

    latitude: Optional[float] = Form(
        default=None
    ),

    longitude: Optional[float] = Form(
        default=None
    ),

    language: str = Form(
        default="en"
    ),

    farm_context: Optional[str] = Form(
        default=None
    ),

    authorization: Optional[str] = Header(
        default=None
    ),
):

    user = get_authenticated_user(
        authorization
    )

    owner_id = str(
        user.id
    )

    (
        resolved_farm_id,
        resolved_plot_id,
        resolved_crop_cycle_id,
    ) = resolve_scan_context(
        owner_id=owner_id,
        farm_id=farm_id,
        plot_id=plot_id,
    )

    crop_cycle_id = (
        resolved_crop_cycle_id
    )

    farm_id = (
        resolved_farm_id
    )

    plot_id = (
        resolved_plot_id
    )

    (
        image_bytes,
        image,
        extension,
    ) = await read_and_validate_image(
        file
    )

    prediction = run_disease_prediction(
        image
    )

    disease = prediction[
        "disease"
    ]

    classifier_confidence = float(
        prediction[
            "confidence"
        ]
    )

    image_path = upload_scan_image(
        image_bytes=image_bytes,
        extension=extension,
        owner_id=owner_id,
    )

    scan = save_scan(
        owner_id=owner_id,
        farm_id=farm_id,
        plot_id=plot_id,
        crop_cycle_id=crop_cycle_id,
        image_url=image_path,
        prediction=prediction,
        latitude=latitude,
        longitude=longitude,
    )

    try:

        advisory = await generate_crop_advisory(
            disease=disease,
            classifier_confidence=(
                classifier_confidence
            ),
            crop="Sugarcane",
            language=language,
            farm_context=farm_context,
        )

    except Exception as exc:

        advisory = {
            "answer": (
                "The crop scan was completed, "
                "but a grounded advisory could "
                "not be generated right now."
            ),
            "confidence": "low",
            "evidence_sufficient": False,
            "needs_more_information": True,
            "follow_up_question": (
                "Please try asking Crop Doctor "
                "again."
            ),
            "sources": [],
            "retrieved_documents": 0,
            "evidence": [],
            "error": str(exc),
        }

    return {
        "success": True,

        "scan_id": scan.get(
            "id"
        ),

        "scan": {
            "id": scan.get(
                "id"
            ),

            "image_url": image_path,

            "farm_id": farm_id,

            "plot_id": plot_id,

            "crop_cycle_id": crop_cycle_id,

            "latitude": latitude,

            "longitude": longitude,

            "created_at": scan.get(
                "created_at"
            ),
        },

        "prediction": prediction,

        "advisory": advisory,
    }

`

## File: backend/app/routes/assistant.py

`py
from typing import Any, Dict, List, Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from pydantic import BaseModel, Field
from supabase import Client, create_client

from app.config import settings
from app.services.rag_service import rag_service
from app.services.ollama_service import ollama_service
from app.services.supabase_service import get_server_supabase


router = APIRouter(
    prefix="/api/assistant",
    tags=["Assistant"],
)


bearer_scheme = HTTPBearer(
    auto_error=True
)


class ChatMessage(BaseModel):
    role: str
    content: str


class AssistantChatRequest(BaseModel):
    question: str = Field(
        min_length=1,
        max_length=2000,
    )

    crop: str = "Sugarcane"

    disease: Optional[str] = None

    classifier_confidence: Optional[float] = None

    language: str = "en"

    farm_id: Optional[str] = None

    plot_id: Optional[str] = None

    crop_cycle_id: Optional[str] = None

    scan_id: Optional[str] = None

    farm_context: Optional[str] = None

    history: List[ChatMessage] = Field(
        default_factory=list,
        max_length=10,
    )


ASSISTANT_SCHEMA = {
    "type": "object",
    "properties": {
        "answer": {
            "type": "string",
        },
        "evidence_sufficient": {
            "type": "boolean",
        },
        "needs_more_information": {
            "type": "boolean",
        },
        "follow_up_question": {
            "type": ["string", "null"],
        },
        "sources": {
            "type": "array",
            "items": {
                "type": "integer",
            },
        },
    },
    "required": [
        "answer",
        "evidence_sufficient",
        "needs_more_information",
        "follow_up_question",
        "sources",
    ],
}


def get_authenticated_user(
    credentials: HTTPAuthorizationCredentials,
):
    """
    Validate the Supabase access token.

    HTTPBearer handles the Authorization header and
    extracts the Bearer token.

    Server-side database operations use the backend
    secret key through get_server_supabase().
    """

    token = credentials.credentials

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token is missing.",
        )

    if not settings.supabase_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_URL is not configured.",
        )

    if not settings.supabase_publishable_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "SUPABASE_PUBLISHABLE_KEY "
                "is not configured."
            ),
        )

    try:
        auth_client = create_client(
            settings.supabase_url,
            settings.supabase_publishable_key,
        )

        response = auth_client.auth.get_user(
            token
        )

        user = response.user

        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired access token.",
            )

        return user

    except HTTPException:
        raise

    except Exception as exc:
        print("")
        print(
            "========== ASSISTANT AUTH ERROR =========="
        )
        print(
            "ERROR TYPE:",
            type(exc).__name__,
        )
        print(
            "ERROR:",
            repr(exc),
        )
        print(
            "=========================================="
        )
        print("")

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
        ) from exc


def calculate_retrieval_confidence(
    documents: list,
) -> str:

    if not documents:
        return "low"

    similarities = []

    for document in documents:

        similarity = document.get(
            "similarity"
        )

        if similarity is None:
            continue

        try:
            similarities.append(
                float(similarity)
            )

        except (
            TypeError,
            ValueError,
        ):
            continue

    if not similarities:
        return "low"

    top_similarity = max(
        similarities
    )

    if top_similarity >= 0.80:
        return "high"

    if top_similarity >= 0.65:
        return "medium"

    return "low"


def validate_source_ids(
    source_ids,
    document_count: int,
) -> List[int]:

    if not isinstance(
        source_ids,
        list,
    ):
        return []

    valid_sources = []

    for source_id in source_ids:

        if not isinstance(
            source_id,
            int,
        ):
            continue

        if (
            1
            <= source_id
            <= document_count
        ):
            valid_sources.append(
                source_id
            )

    return sorted(
        set(valid_sources)
    )


def clean_answer(
    answer: str,
) -> str:

    if not answer:
        return (
            "I don't have enough trusted "
            "agricultural evidence to answer "
            "that safely."
        )

    import re

    answer = re.sub(
        r"\s*\*\\?source[s]?\*?\s*:\s*"
        r"\[[^\]]*\]",
        "",
        answer,
        flags=re.IGNORECASE,
    )

    answer = re.sub(
        r"\s*\[[0-9]+(?:\s*,\s*[0-9]+)*\]\s*$",
        "",
        answer,
    )

    answer = answer.replace(
        "roughening",
        "rouging",
    )

    answer = answer.replace(
        "Roughening",
        "Rouging",
    )

    return answer.strip()


def verify_farm_ownership(
    supabase: Client,
    farm_id: str,
    user_id: str,
) -> Dict[str, Any]:

    response = (
        supabase
        .table("farms")
        .select("*")
        .eq("id", farm_id)
        .eq("owner_id", user_id)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found.",
        )

    return response.data[0]


def verify_plot_ownership(
    supabase: Client,
    plot_id: str,
    farm_id: str,
    user_id: str,
) -> Dict[str, Any]:

    response = (
        supabase
        .table("plots")
        .select("*")
        .eq("id", plot_id)
        .eq("farm_id", farm_id)
        .eq("owner_id", user_id)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plot not found.",
        )

    return response.data[0]


def verify_crop_cycle_ownership(
    supabase: Client,
    crop_cycle_id: str,
    plot_id: Optional[str],
    user_id: str,
) -> Dict[str, Any]:

    query = (
        supabase
        .table("crop_cycles")
        .select("*")
        .eq("id", crop_cycle_id)
        .eq("owner_id", user_id)
    )

    if plot_id:
        query = query.eq(
            "plot_id",
            plot_id,
        )

    response = (
        query
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Crop cycle not found.",
        )

    return response.data[0]


def verify_scan_ownership(
    supabase: Client,
    scan_id: str,
    farm_id: str,
    plot_id: Optional[str],
    user_id: str,
) -> Dict[str, Any]:

    query = (
        supabase
        .table("crop_scans")
        .select("*")
        .eq("id", scan_id)
        .eq("farm_id", farm_id)
        .eq("owner_id", user_id)
    )

    if plot_id:
        query = query.eq(
            "plot_id",
            plot_id,
        )

    response = (
        query
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found.",
        )

    return response.data[0]


def load_farm_context(
    supabase: Client,
    farm_id: str,
    user_id: str,
    plot_id: Optional[str] = None,
    crop_cycle_id: Optional[str] = None,
) -> List[Dict[str, Any]]:

    query = (
        supabase
        .table("farm_context_entries")
        .select("*")
        .eq("farm_id", farm_id)
        .eq("owner_id", user_id)
    )

    response = (
        query
        .order(
            "recorded_at",
            desc=True,
        )
        .limit(200)
        .execute()
    )

    entries = response.data or []

    filtered_entries = []

    for entry in entries:

        entry_plot_id = entry.get(
            "plot_id"
        )

        entry_crop_cycle_id = entry.get(
            "crop_cycle_id"
        )

        if (
            entry_plot_id is None
            and entry_crop_cycle_id is None
        ):
            filtered_entries.append(
                entry
            )

            continue

        if (
            entry_plot_id is not None
            and entry_crop_cycle_id is None
        ):

            if (
                plot_id
                and entry_plot_id == plot_id
            ):
                filtered_entries.append(
                    entry
                )

            continue

        if (
            entry_crop_cycle_id is not None
            and entry_crop_cycle_id == crop_cycle_id
        ):

            if (
                entry_plot_id is not None
                and entry_plot_id != plot_id
            ):
                continue

            filtered_entries.append(
                entry
            )

            continue

    return filtered_entries[:100]


def format_farm_context(
    context_entries: List[Dict[str, Any]],
) -> str:

    if not context_entries:
        return (
            "No persistent farm context available."
        )

    lines = []

    for entry in context_entries:

        category = (
            entry.get("category")
            or "unknown"
        )

        key = (
            entry.get("key")
            or "unknown"
        )

        source_type = (
            entry.get("source_type")
            or "unknown"
        )

        confidence = (
            entry.get("confidence")
            or "unknown"
        )

        value_text = entry.get(
            "value_text"
        )

        value_number = entry.get(
            "value_number"
        )

        value_json = entry.get(
            "value_json"
        )

        if value_text is not None:
            value = value_text

        elif value_number is not None:
            value = str(
                value_number
            )

        elif value_json is not None:
            value = str(
                value_json
            )

        else:
            value = "No value"

        lines.append(
            f"- Category: {category}; "
            f"Key: {key}; "
            f"Value: {value}; "
            f"Source: {source_type}; "
            f"Confidence: {confidence}"
        )

    return "\n".join(lines)


def load_persistent_messages(
    supabase: Client,
    farm_id: str,
    user_id: str,
    plot_id: Optional[str] = None,
    crop_cycle_id: Optional[str] = None,
    scan_id: Optional[str] = None,
) -> List[Dict[str, Any]]:

    query = (
        supabase
        .table("assistant_messages")
        .select(
            "id,role,content,language,"
            "farm_id,plot_id,crop_cycle_id,"
            "scan_id,created_at"
        )
        .eq("farm_id", farm_id)
        .eq("owner_id", user_id)
    )

    if plot_id:
        query = query.eq(
            "plot_id",
            plot_id,
        )

    if crop_cycle_id:
        query = query.eq(
            "crop_cycle_id",
            crop_cycle_id,
        )

    if scan_id:
        query = query.eq(
            "scan_id",
            scan_id,
        )

    response = (
        query
        .order(
            "created_at",
            desc=True,
        )
        .limit(10)
        .execute()
    )

    messages = response.data or []

    messages.reverse()

    return messages


def format_conversation(
    messages: List[Dict[str, Any]],
) -> str:

    if not messages:
        return "No previous conversation."

    lines = []

    for message in messages:

        role = (
            message.get("role")
            or ""
        ).lower().strip()

        if role not in {
            "user",
            "assistant",
        }:
            continue

        content = (
            message.get("content")
            or ""
        ).strip()

        if not content:
            continue

        lines.append(
            f"{role.upper()}: {content}"
        )

    if not lines:
        return "No previous conversation."

    return "\n".join(lines)


def save_assistant_message(
    supabase: Client,
    user_id: str,
    farm_id: Optional[str],
    plot_id: Optional[str],
    crop_cycle_id: Optional[str],
    scan_id: Optional[str],
    role: str,
    content: str,
    language: str,
) -> Dict[str, Any]:

    row = {
        "owner_id": user_id,
        "farm_id": farm_id,
        "plot_id": plot_id,
        "crop_cycle_id": crop_cycle_id,
        "scan_id": scan_id,
        "role": role,
        "content": content,
        "language": language,
    }

    try:

        response = (
            supabase
            .table("assistant_messages")
            .insert(row)
            .execute()
        )

    except Exception as exc:

        print("")
        print(
            "========== ASSISTANT MESSAGE SAVE ERROR =========="
        )
        print(
            "ROLE:",
            role,
        )
        print(
            "ERROR TYPE:",
            type(exc).__name__,
        )
        print(
            "ERROR:",
            repr(exc),
        )
        print(
            "==================================================="
        )
        print("")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Failed to save assistant conversation."
            ),
        ) from exc

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Assistant conversation was not saved."
            ),
        )

    return response.data[0]


SYSTEM_PROMPT = """
You are KisanX Crop Doctor.

You are answering a farmer's follow-up question
about their sugarcane crop.

============================================================
CORE RULE
============================================================

Use ONLY the supplied retrieved evidence for
agricultural facts.

Farm memory and farmer-reported information are
CONTEXT, not scientific evidence.

Conversation history is CONTEXT only.

Conversation history is NOT agricultural evidence.

The AI disease prediction is also context,
not scientific proof.

============================================================
USE RETRIEVED EVIDENCE
============================================================

Read every supplied source.

If the sources directly answer the farmer's
question, provide the supported answer.

If the source contains a practical management
recommendation, explain that recommendation.

Do not simply say "consult ICAR" when the
retrieved evidence already contains relevant
guidance.

Do not extend a source beyond what it actually
supports.

============================================================
NEVER INVENT
============================================================

Never invent:

- pesticide names
- fungicide names
- insecticide names
- chemical doses
- concentrations
- application rates
- spray schedules
- fertilizer quantities
- disease causes
- transmission mechanisms
- weather thresholds
- temperature thresholds
- treatment timelines

unless explicitly supported by retrieved evidence.

If evidence gives a product but not its dose,
do not invent the dose.

============================================================
FARM MEMORY
============================================================

Farm memory may contain:

- farmer-reported observations
- measured values
- estimated values
- AI-inferred values
- external information

Treat each according to its source label.

Never turn:

farmer_reported

into:

measured fact.

Never turn:

estimated

into:

measured fact.

Never claim that a farmer-reported observation
was scientifically verified.

Use farm memory to understand the farmer's
specific situation and to personalize the answer.

============================================================
DIAGNOSIS
============================================================

Do not treat the AI prediction as a confirmed diagnosis.

Use wording such as:

"the scan indicates"

"this may be consistent with"

"check for"

when appropriate.

============================================================
INSUFFICIENT EVIDENCE
============================================================

If the retrieved evidence does not answer the
farmer's specific question:

DO NOT GUESS.

Set:

evidence_sufficient = false

and:

needs_more_information = true

if additional information is genuinely required.

============================================================
LANGUAGE
============================================================

Answer in the requested language.

English -> English.

Hindi -> Hindi.

Marathi -> Marathi.

Keep the answer simple and farmer-friendly.

============================================================
CONVERSATION
============================================================

Use previous messages to understand references
such as:

"this"

"it"

"the disease"

"what about that"

But do not treat previous answers as factual evidence.

============================================================
SOURCES
============================================================

Only return source numbers that directly support
the answer.

Never put source numbers inside the answer text.

============================================================
OUTPUT
============================================================

Return ONLY valid JSON matching the supplied schema.

No Markdown.

No text outside JSON.
"""


@router.post(
    "/chat",
    dependencies=[
        Depends(bearer_scheme)
    ],
)
async def assistant_chat(
    request: AssistantChatRequest,
    credentials: HTTPAuthorizationCredentials = Depends(
        bearer_scheme
    ),
):

    user = get_authenticated_user(
        credentials
    )

    user_id = user.id

    supabase = get_server_supabase()

    if request.farm_id:

        verify_farm_ownership(
            supabase=supabase,
            farm_id=request.farm_id,
            user_id=user_id,
        )

    if request.plot_id:

        if not request.farm_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "farm_id is required when "
                    "plot_id is provided."
                ),
            )

        verify_plot_ownership(
            supabase=supabase,
            plot_id=request.plot_id,
            farm_id=request.farm_id,
            user_id=user_id,
        )

    if request.crop_cycle_id:

        if not request.farm_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "farm_id is required when "
                    "crop_cycle_id is provided."
                ),
            )

        verify_crop_cycle_ownership(
            supabase=supabase,
            crop_cycle_id=request.crop_cycle_id,
            plot_id=request.plot_id,
            user_id=user_id,
        )

    if request.scan_id:

        if not request.farm_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "farm_id is required when "
                    "scan_id is provided."
                ),
            )

        verify_scan_ownership(
            supabase=supabase,
            scan_id=request.scan_id,
            farm_id=request.farm_id,
            plot_id=request.plot_id,
            user_id=user_id,
        )

    persistent_context_entries = []

    if request.farm_id:

        persistent_context_entries = (
            load_farm_context(
                supabase=supabase,
                farm_id=request.farm_id,
                user_id=user_id,
                plot_id=request.plot_id,
                crop_cycle_id=request.crop_cycle_id,
            )
        )

    persistent_farm_context = (
        format_farm_context(
            persistent_context_entries
        )
    )

    persistent_messages = []

    if request.farm_id:

        persistent_messages = (
            load_persistent_messages(
                supabase=supabase,
                farm_id=request.farm_id,
                user_id=user_id,
                plot_id=request.plot_id,
                crop_cycle_id=request.crop_cycle_id,
                scan_id=request.scan_id,
            )
        )

    persistent_history_text = (
        format_conversation(
            persistent_messages
        )
    )

    if request.farm_id:

        save_assistant_message(
            supabase=supabase,
            user_id=user_id,
            farm_id=request.farm_id,
            plot_id=request.plot_id,
            crop_cycle_id=request.crop_cycle_id,
            scan_id=request.scan_id,
            role="user",
            content=request.question,
            language=request.language,
        )

    query_parts = [
        f"Crop: {request.crop}",
    ]

    if request.disease:

        query_parts.append(
            f"Disease: {request.disease}"
        )

    if request.classifier_confidence is not None:

        query_parts.append(
            "AI classifier confidence: "
            f"{request.classifier_confidence}"
        )

    if request.farm_context:

        query_parts.append(
            "Current farmer-provided context: "
            f"{request.farm_context}"
        )

    if persistent_farm_context:

        query_parts.append(
            "Persistent farm context: "
            f"{persistent_farm_context}"
        )

    query_parts.append(
        "Farmer question: "
        f"{request.question}"
    )

    retrieval_query = "\n".join(
        query_parts
    )

    try:

        documents = rag_service.retrieve(
            query=retrieval_query,
            match_count=5,
            crop=request.crop,
            disease=request.disease,
        )

    except Exception as exc:

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Knowledge retrieval failed: "
                f"{str(exc)}"
            ),
        ) from exc

    if not documents:

        answer_text = (
            "I don't have enough trusted "
            "agricultural evidence to answer "
            "that specific question safely."
        )

        if request.farm_id:

            save_assistant_message(
                supabase=supabase,
                user_id=user_id,
                farm_id=request.farm_id,
                plot_id=request.plot_id,
                crop_cycle_id=request.crop_cycle_id,
                scan_id=request.scan_id,
                role="assistant",
                content=answer_text,
                language=request.language,
            )

        return {
            "question": request.question,
            "crop": request.crop,
            "disease": request.disease,
            "answer": {
                "answer": answer_text,
                "confidence": "low",
                "evidence_sufficient": False,
                "needs_more_information": True,
                "follow_up_question": (
                    "Can you provide more details "
                    "about what you are seeing "
                    "in the field?"
                ),
                "sources": [],
            },
            "retrieved_documents": 0,
            "evidence": [],
            "memory": {
                "farm_context_loaded": (
                    len(
                        persistent_context_entries
                    )
                ),
                "messages_loaded": (
                    len(
                        persistent_messages
                    )
                ),
                "conversation_saved": bool(
                    request.farm_id
                ),
            },
        }

    retrieval_confidence = (
        calculate_retrieval_confidence(
            documents
        )
    )

    evidence_blocks = []

    for index, document in enumerate(
        documents,
        start=1,
    ):

        evidence_blocks.append(
            (
                f"SOURCE {index}\n"
                f"Title: "
                f"{document.get('title')}\n"
                f"Organization: "
                f"{document.get('source_name')}\n"
                f"URL: "
                f"{document.get('source_url')}\n"
                f"Similarity: "
                f"{document.get('similarity')}\n"
                f"Evidence:\n"
                f"{document.get('content')}"
            )
        )

    evidence = "\n\n".join(
        evidence_blocks
    )

    frontend_history_lines = []

    for message in request.history[-10:]:

        role = (
            message.role
            .lower()
            .strip()
        )

        if role not in {
            "user",
            "assistant",
        }:
            continue

        content = (
            message.content
            .strip()
        )

        if not content:
            continue

        frontend_history_lines.append(
            f"{role.upper()}: {content}"
        )

    frontend_history_text = (
        "\n".join(
            frontend_history_lines
        )
        if frontend_history_lines
        else "No frontend conversation history."
    )

    user_prompt = f"""
CURRENT CROP

{request.crop}


CURRENT AI DISEASE PREDICTION

{request.disease or "Unknown"}


AI CLASSIFIER CONFIDENCE

{
        request.classifier_confidence
        if request.classifier_confidence is not None
        else "Not provided"
    }


REQUESTED LANGUAGE

{request.language}


FARM ID

{request.farm_id or "Not provided"}


PLOT ID

{request.plot_id or "Not provided"}


CROP CYCLE ID

{request.crop_cycle_id or "Not provided"}


SCAN ID

{request.scan_id or "Not provided"}


CURRENT MANUAL FARM CONTEXT

{request.farm_context or "Not provided"}


PERSISTENT FARM MEMORY

{persistent_farm_context}


PERSISTENT CONVERSATION

{persistent_history_text}


FRONTEND CONVERSATION HISTORY

{frontend_history_text}


NEW FARMER QUESTION

{request.question}


TRUSTED RETRIEVED EVIDENCE

{evidence}


TASK

Answer the farmer's NEW question.

Use persistent farm memory only as context.

Use previous conversations only to understand
the context of the question.

Use ONLY the trusted retrieved evidence for
agricultural facts.

If the evidence directly supports an actionable
answer, give that answer clearly.

If the evidence does not support the requested
claim, do not guess.

Do not invent pesticide doses, concentrations,
treatment schedules, causes, transmission
mechanisms, or other missing facts.

If the farmer asks for information not present
in the retrieved evidence, explicitly explain
that the available trusted evidence is
insufficient.

Return ONLY valid JSON.
"""

    result = await ollama_service.generate_json(
        system_prompt=SYSTEM_PROMPT,
        user_prompt=user_prompt,
        schema=ASSISTANT_SCHEMA,
    )

    if "error" in result:

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "The crop assistant could not "
                "generate a valid grounded answer."
            ),
        )

    source_ids = validate_source_ids(
        result.get(
            "sources",
            [],
        ),
        len(documents),
    )

    answer_text = clean_answer(
        result.get(
            "answer",
            "",
        )
    )

    evidence_sufficient = bool(
        result.get(
            "evidence_sufficient",
            False,
        )
    )

    needs_more_information = bool(
        result.get(
            "needs_more_information",
            False,
        )
    )

    follow_up_question = result.get(
        "follow_up_question"
    )

    if not isinstance(
        follow_up_question,
        str,
    ):

        follow_up_question = None

    if request.farm_id:

        save_assistant_message(
            supabase=supabase,
            user_id=user_id,
            farm_id=request.farm_id,
            plot_id=request.plot_id,
            crop_cycle_id=request.crop_cycle_id,
            scan_id=request.scan_id,
            role="assistant",
            content=answer_text,
            language=request.language,
        )

    return {
        "question": request.question,

        "crop": request.crop,

        "disease": request.disease,

        "answer": {
            "answer": answer_text,

            "confidence": (
                retrieval_confidence
            ),

            "evidence_sufficient": (
                evidence_sufficient
            ),

            "needs_more_information": (
                needs_more_information
            ),

            "follow_up_question": (
                follow_up_question
            ),

            "sources": source_ids,
        },

        "retrieved_documents": len(
            documents
        ),

        "evidence": documents,

        "memory": {
            "farm_context_loaded": (
                len(
                    persistent_context_entries
                )
            ),

            "messages_loaded": (
                len(
                    persistent_messages
                )
            ),

            "conversation_saved": (
                bool(request.farm_id)
            ),
        },
    }

`

## File: backend/app/routes/farms.py

`py
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from supabase import Client, create_client

from app.schemas.farms import FarmRegistrationRequest


router = APIRouter(
    prefix="/api/farms",
    tags=["Farms"],
)


class AuthenticatedUser(BaseModel):
    id: str


def get_settings():
    from app.config import settings
    return settings


def get_supabase() -> Client:
    settings = get_settings()

    print("")
    print("========== SUPABASE CONFIG CHECK ==========")
    print("SUPABASE_URL loaded:", bool(settings.supabase_url))
    print(
        "SUPABASE_PUBLISHABLE_KEY loaded:",
        bool(settings.supabase_publishable_key),
    )
    print(
        "SUPABASE_SERVICE_KEY loaded:",
        bool(settings.supabase_service_key),
    )
    print("============================================")
    print("")

    if not settings.supabase_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase URL is not configured.",
        )

    if not settings.supabase_service_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase server secret is not configured.",
        )

    try:
        return create_client(
            settings.supabase_url,
            settings.supabase_service_key,
        )
    except Exception as exc:
        print("========== SUPABASE CLIENT ERROR ==========")
        print(type(exc).__name__)
        print(repr(exc))
        print("============================================")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase client creation failed: {str(exc)}",
        ) from exc


def get_authenticated_user(
    authorization: str = Header(...),
) -> AuthenticatedUser:

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header.",
        )

    token = authorization.replace(
        "Bearer ",
        "",
        1,
    ).strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing access token.",
        )

    settings = get_settings()

    if not settings.supabase_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase URL is not configured.",
        )

    if not settings.supabase_publishable_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase publishable key is not configured.",
        )

    try:
        supabase = create_client(
            settings.supabase_url,
            settings.supabase_publishable_key,
        )

        response = supabase.auth.get_user(token)

    except Exception as exc:
        print("")
        print("========== AUTHENTICATION ERROR ==========")
        print("ERROR TYPE:", type(exc).__name__)
        print("ERROR:", repr(exc))
        print("==========================================")
        print("")

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
        ) from exc

    if not response.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user not found.",
        )

    print(
        "Authenticated user:",
        response.user.id,
    )

    return AuthenticatedUser(
        id=response.user.id,
    )


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
)
def register_farm(
    payload: FarmRegistrationRequest,
    user: AuthenticatedUser = Depends(
        get_authenticated_user
    ),
):

    supabase = get_supabase()

    farm_id = None
    plot_id = None

    try:

        farm_data = {
            "owner_id": user.id,
            "name": payload.farm.name,
            "village": payload.farm.village,
            "district": payload.farm.district,
            "latitude": payload.farm.latitude,
            "longitude": payload.farm.longitude,
            "area_acres": payload.farm.area_acres,
        }

        print("")
        print("========== CREATING FARM ==========")
        print(farm_data)
        print("====================================")

        farm_response = (
            supabase
            .table("farms")
            .insert(farm_data)
            .execute()
        )

        if not farm_response.data:
            raise Exception(
                "Farm insert returned no data."
            )

        farm = farm_response.data[0]
        farm_id = farm["id"]

        print(
            "Farm created successfully:",
            farm_id,
        )

        plot_data = {
            "farm_id": farm_id,
            "owner_id": user.id,
            "name": payload.plot.name,
            "area_acres": payload.plot.area_acres,
            "latitude": payload.plot.latitude,
            "longitude": payload.plot.longitude,
            "boundary": payload.plot.boundary,
        }

        print("")
        print("========== CREATING PLOT ==========")
        print(plot_data)
        print("====================================")

        plot_response = (
            supabase
            .table("plots")
            .insert(plot_data)
            .execute()
        )

        if not plot_response.data:
            raise Exception(
                "Plot insert returned no data."
            )

        plot = plot_response.data[0]
        plot_id = plot["id"]

        print(
            "Plot created successfully:",
            plot_id,
        )

        crop_cycle_data = {
            "plot_id": plot_id,
            "owner_id": user.id,
            "crop_name": payload.crop_cycle.crop_name,
            "variety": payload.crop_cycle.variety,
            "crop_stage": payload.crop_cycle.crop_stage,
            "planting_date": (
                payload.crop_cycle.planting_date.isoformat()
                if payload.crop_cycle.planting_date
                else None
            ),
            "soil_type": payload.crop_cycle.soil_type,
            "status": "ACTIVE",
        }

        print("")
        print("======= CREATING CROP CYCLE =======")
        print(crop_cycle_data)
        print("====================================")

        crop_response = (
            supabase
            .table("crop_cycles")
            .insert(crop_cycle_data)
            .execute()
        )

        if not crop_response.data:
            raise Exception(
                "Crop cycle insert returned no data."
            )

        crop_cycle = crop_response.data[0]

        print(
            "Crop cycle created successfully:",
            crop_cycle["id"],
        )

        print("")
        print("==========================================")
        print("     FARM REGISTRATION SUCCESSFUL")
        print("==========================================")
        print("")

        return {
            "success": True,
            "message": "Farm registered successfully.",
            "farm": farm,
            "plot": plot,
            "crop_cycle": crop_cycle,
        }

    except HTTPException:
        print("")
        print("========== HTTP ERROR ==========")
        print("An HTTP error occurred.")
        print("================================")
        print("")

        if plot_id:
            try:
                (
                    supabase
                    .table("plots")
                    .delete()
                    .eq("id", plot_id)
                    .execute()
                )
            except Exception as rollback_error:
                print(
                    "Plot rollback failed:",
                    repr(rollback_error),
                )

        if farm_id:
            try:
                (
                    supabase
                    .table("farms")
                    .delete()
                    .eq("id", farm_id)
                    .execute()
                )
            except Exception as rollback_error:
                print(
                    "Farm rollback failed:",
                    repr(rollback_error),
                )

        raise

    except Exception as exc:

        print("")
        print("==============================================")
        print("       FARM REGISTRATION ERROR")
        print("==============================================")
        print("ERROR TYPE:")
        print(type(exc).__name__)
        print("")
        print("ERROR:")
        print(repr(exc))
        print("")
        print("ERROR STRING:")
        print(str(exc))
        print("==============================================")
        print("")

        if plot_id:
            try:
                (
                    supabase
                    .table("plots")
                    .delete()
                    .eq("id", plot_id)
                    .execute()
                )

                print(
                    "Plot rollback successful."
                )

            except Exception as rollback_error:
                print(
                    "Plot rollback failed:",
                    repr(rollback_error),
                )

        if farm_id:
            try:
                (
                    supabase
                    .table("farms")
                    .delete()
                    .eq("id", farm_id)
                    .execute()
                )

                print(
                    "Farm rollback successful."
                )

            except Exception as rollback_error:
                print(
                    "Farm rollback failed:",
                    repr(rollback_error),
                )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Farm registration failed: {str(exc)}",
        ) from exc

`

## File: backend/app/routes/farm_intelligence.py

`py
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from supabase import Client, create_client

from app.services.supabase_service import get_server_supabase


router = APIRouter(
    prefix="/api/farm-intelligence",
    tags=["Farm Intelligence"],
)


class AuthenticatedUser(BaseModel):
    id: str


def get_settings():
    from app.config import settings
    return settings


def get_authenticated_user(
    authorization: str = Header(...),
) -> AuthenticatedUser:

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header.",
        )

    token = authorization.replace(
        "Bearer ",
        "",
        1,
    ).strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing access token.",
        )

    settings = get_settings()

    if not settings.supabase_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase URL is not configured.",
        )

    if not settings.supabase_publishable_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase publishable key is not configured.",
        )

    try:
        supabase = create_client(
            settings.supabase_url,
            settings.supabase_publishable_key,
        )

        response = supabase.auth.get_user(token)

    except Exception as exc:

        print("")
        print("========== FARM INTELLIGENCE AUTH ERROR ==========")
        print("ERROR TYPE:", type(exc).__name__)
        print("ERROR:", repr(exc))
        print("===================================================")
        print("")

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
        ) from exc

    if not response.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user not found.",
        )

    return AuthenticatedUser(
        id=response.user.id,
    )


class ContextEntryCreate(BaseModel):
    farm_id: str

    plot_id: Optional[str] = None

    crop_cycle_id: Optional[str] = None

    category: str = Field(
        min_length=1,
        max_length=100,
    )

    key: str = Field(
        min_length=1,
        max_length=150,
    )

    value_text: Optional[str] = None

    value_number: Optional[float] = None

    value_json: Optional[Dict[str, Any]] = None

    source_type: str = "farmer_reported"

    confidence: str = "medium"

    language: str = "en"


VALID_SOURCE_TYPES = {
    "farmer_reported",
    "measured",
    "estimated",
    "ai_inferred",
    "external_source",
}


VALID_CONFIDENCE_LEVELS = {
    "low",
    "medium",
    "high",
}


def validate_context_payload(
    payload: ContextEntryCreate,
) -> None:

    if payload.source_type not in VALID_SOURCE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid source_type. Allowed values: "
                "farmer_reported, measured, estimated, "
                "ai_inferred, external_source."
            ),
        )

    if payload.confidence not in VALID_CONFIDENCE_LEVELS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid confidence. Allowed values: "
                "low, medium, high."
            ),
        )

    if (
        payload.value_text is None
        and payload.value_number is None
        and payload.value_json is None
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "At least one of value_text, "
                "value_number, or value_json is required."
            ),
        )


def verify_farm_ownership(
    supabase: Client,
    farm_id: str,
    user_id: str,
) -> Dict[str, Any]:

    response = (
        supabase
        .table("farms")
        .select("*")
        .eq("id", farm_id)
        .eq("owner_id", user_id)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found.",
        )

    return response.data[0]


@router.get("/{farm_id}/context")
def get_farm_context(
    farm_id: str,
    category: Optional[str] = None,
    plot_id: Optional[str] = None,
    limit: int = 100,
    user: AuthenticatedUser = Depends(
        get_authenticated_user
    ),
):

    limit = max(1, min(limit, 200))

    supabase = get_server_supabase()

    verify_farm_ownership(
        supabase=supabase,
        farm_id=farm_id,
        user_id=user.id,
    )

    query = (
        supabase
        .table("farm_context_entries")
        .select("*")
        .eq("farm_id", farm_id)
        .eq("owner_id", user.id)
    )

    if category:
        query = query.eq(
            "category",
            category,
        )

    if plot_id:
        query = query.eq(
            "plot_id",
            plot_id,
        )

    response = (
        query
        .order(
            "recorded_at",
            desc=True,
        )
        .limit(limit)
        .execute()
    )

    return {
        "success": True,
        "farm_id": farm_id,
        "count": len(response.data or []),
        "context": response.data or [],
    }


@router.post(
    "/{farm_id}/context",
    status_code=status.HTTP_201_CREATED,
)
def create_farm_context(
    farm_id: str,
    payload: ContextEntryCreate,
    user: AuthenticatedUser = Depends(
        get_authenticated_user
    ),
):

    if payload.farm_id != farm_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="farm_id in body does not match URL farm_id.",
        )

    validate_context_payload(payload)

    supabase = get_server_supabase()

    verify_farm_ownership(
        supabase=supabase,
        farm_id=farm_id,
        user_id=user.id,
    )

    row = {
        "owner_id": user.id,
        "farm_id": farm_id,
        "plot_id": payload.plot_id,
        "crop_cycle_id": payload.crop_cycle_id,
        "category": payload.category,
        "key": payload.key,
        "value_text": payload.value_text,
        "value_number": payload.value_number,
        "value_json": payload.value_json,
        "source_type": payload.source_type,
        "confidence": payload.confidence,
        "language": payload.language,
    }

    try:

        response = (
            supabase
            .table("farm_context_entries")
            .insert(row)
            .execute()
        )

    except Exception as exc:

        print("")
        print("========== CONTEXT INSERT ERROR ==========")
        print("ERROR TYPE:", type(exc).__name__)
        print("ERROR:", repr(exc))
        print("===========================================")
        print("")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Failed to save farm context: "
                f"{str(exc)}"
            ),
        ) from exc

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Farm context was not saved.",
        )

    return {
        "success": True,
        "message": "Farm context saved successfully.",
        "context": response.data[0],
    }


@router.delete("/{farm_id}/context/{context_id}")
def delete_farm_context(
    farm_id: str,
    context_id: str,
    user: AuthenticatedUser = Depends(
        get_authenticated_user
    ),
):

    supabase = get_server_supabase()

    verify_farm_ownership(
        supabase=supabase,
        farm_id=farm_id,
        user_id=user.id,
    )

    response = (
        supabase
        .table("farm_context_entries")
        .delete()
        .eq("id", context_id)
        .eq("farm_id", farm_id)
        .eq("owner_id", user.id)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm context entry not found.",
        )

    return {
        "success": True,
        "message": "Farm context deleted successfully.",
        "context": response.data[0],
    }


@router.get("/{farm_id}/scans")
def get_scan_history(
    farm_id: str,
    plot_id: Optional[str] = None,
    crop_cycle_id: Optional[str] = None,
    limit: int = 100,
    user: AuthenticatedUser = Depends(
        get_authenticated_user
    ),
):

    limit = max(1, min(limit, 200))

    supabase = get_server_supabase()

    verify_farm_ownership(
        supabase=supabase,
        farm_id=farm_id,
        user_id=user.id,
    )

    query = (
        supabase
        .table("crop_scans")
        .select("*")
        .eq("farm_id", farm_id)
        .eq("owner_id", user.id)
    )

    if plot_id:
        query = query.eq(
            "plot_id",
            plot_id,
        )

    if crop_cycle_id:
        query = query.eq(
            "crop_cycle_id",
            crop_cycle_id,
        )

    response = (
        query
        .order(
            "created_at",
            desc=True,
        )
        .limit(limit)
        .execute()
    )

    return {
        "success": True,
        "farm_id": farm_id,
        "count": len(response.data or []),
        "scans": response.data or [],
    }


@router.get("/{farm_id}/messages")
def get_assistant_messages(
    farm_id: str,
    plot_id: Optional[str] = None,
    crop_cycle_id: Optional[str] = None,
    scan_id: Optional[str] = None,
    limit: int = 100,
    user: AuthenticatedUser = Depends(
        get_authenticated_user
    ),
):

    limit = max(1, min(limit, 300))

    supabase = get_server_supabase()

    verify_farm_ownership(
        supabase=supabase,
        farm_id=farm_id,
        user_id=user.id,
    )

    query = (
        supabase
        .table("assistant_messages")
        .select("*")
        .eq("farm_id", farm_id)
        .eq("owner_id", user.id)
    )

    if plot_id:
        query = query.eq(
            "plot_id",
            plot_id,
        )

    if crop_cycle_id:
        query = query.eq(
            "crop_cycle_id",
            crop_cycle_id,
        )

    if scan_id:
        query = query.eq(
            "scan_id",
            scan_id,
        )

    response = (
        query
        .order(
            "created_at",
            desc=False,
        )
        .limit(limit)
        .execute()
    )

    return {
        "success": True,
        "farm_id": farm_id,
        "count": len(response.data or []),
        "messages": response.data or [],
    }

`

## File: backend/app/config.py

`py
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    supabase_secret_key: str = ""
    supabase_service_role_key: str = ""

    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "gemma3:4b"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def server_secret_key(self) -> str:
        """
        Prefer the newer Supabase secret key.

        Fall back to the legacy service-role key if present.
        Both are backend-only secrets.
        """
        return (
            self.supabase_secret_key
            or self.supabase_service_role_key
        )


settings = Settings()

`

## File: backend/app/main.py

`py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

from app.routes.assistant import (
    router as assistant_router,
)
from app.routes.farms import (
    router as farms_router,
)
from app.routes.scans import (
    router as scans_router,
)
from app.routes.rag import (
    router as rag_router,
)
from app.routes.farm_intelligence import (
    router as farm_intelligence_router,
)
from app.routes.weather import (
    router as weather_router,
)


app = FastAPI(
    title="KisanX API",
    description=(
        "AI-Powered Crop Health, Harvest "
        "& Market Intelligence API"
    ),
    version="0.5.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(
    farms_router
)

app.include_router(
    scans_router
)

app.include_router(
    rag_router
)

app.include_router(
    assistant_router
)

app.include_router(
    farm_intelligence_router
)

app.include_router(
    weather_router
)


@app.get("/")
def root():

    return {
        "status": "ok",
        "service": "kisanx-api",
        "version": "0.5.0",
    }


@app.get("/health")
def health_check():

    return {
        "status": "ok",
        "service": "kisanx-api",
        "ollama": {
            "base_url": settings.ollama_base_url,
            "model": settings.ollama_model,
        },
    }

`

## File: frontend/app/dashboard/scan/page.tsx

`tsx
"use client";

import { ChangeEvent, KeyboardEvent, useEffect, useState } from "react";

import Link from "next/link";

import { createClient } from "@/lib/supabase/client";

type Farm = {
  id: string;
  name: string;
  village?: string | null;
  district?: string | null;
};

type Plot = {
  id: string;
  name: string;
  farm_id: string;
};

type Prediction = {
  disease: string;
  confidence: number;
  class_probabilities?: Record<string, number>;
  severity?: number | null;
};

type AdvisoryEvidence = {
  title?: string;
  source_name?: string;
  source_url?: string | null;
  similarity?: number;
  content?: string;
};

type Advisory = {
  answer: string;
  confidence?: string;
  evidence_sufficient?: boolean;
  needs_more_information?: boolean;
  follow_up_question?: string | null;
  sources?: number[];
  retrieved_documents?: number;
  evidence?: AdvisoryEvidence[];
};

type ScanRecord = {
  id: string;
  image_url?: string | null;
  farm_id?: string | null;
  plot_id?: string | null;
  crop_cycle_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string | null;
};

type ScanResponse = {
  success: boolean;
  scan_id: string;
  scan: ScanRecord;
  prediction: Prediction;
  advisory: Advisory;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const API_URL =
  process.env.NEXT_PUBLIC_KISANX_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

export default function CropScanPage() {
  const supabase = createClient();

  const [farms, setFarms] = useState<Farm[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);

  const [selectedFarm, setSelectedFarm] = useState("");
  const [selectedPlot, setSelectedPlot] = useState("");

  // ----------------------------------------------------------
  // IMAGE
  // ----------------------------------------------------------

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [previewUrl, setPreviewUrl] = useState("");

  // ----------------------------------------------------------
  // LOCATION
  // ----------------------------------------------------------

  const [latitude, setLatitude] = useState<number | null>(null);

  const [longitude, setLongitude] = useState<number | null>(null);

  const [locationLoading, setLocationLoading] = useState(false);

  // ----------------------------------------------------------
  // LANGUAGE
  // ----------------------------------------------------------

  const [language, setLanguage] = useState("en");

  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");

  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);

  // ----------------------------------------------------------
  // CHAT
  // ----------------------------------------------------------

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const [chatInput, setChatInput] = useState("");

  const [chatLoading, setChatLoading] = useState(false);

  const [chatError, setChatError] = useState("");

  // ==========================================================
  // LOAD FARMS
  // ==========================================================

  useEffect(() => {
    let mounted = true;

    async function loadFarms() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || !mounted) {
          return;
        }

        const { data, error: farmError } = await supabase
          .from("farms")
          .select("id, name, village, district")
          .eq("owner_id", user.id)
          .order("created_at", {
            ascending: false,
          });

        if (farmError) {
          console.error("FARM LOAD ERROR:", farmError);

          if (mounted) {
            setError("Could not load your farms.");
          }

          return;
        }

        if (mounted) {
          setFarms(data || []);
        }
      } catch (err) {
        console.error("LOAD FARMS ERROR:", err);

        if (mounted) {
          setError("Could not load your farms.");
        }
      }
    }

    loadFarms();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadPlots() {
      if (!selectedFarm) {
        setPlots([]);
        setSelectedPlot("");
        return;
      }

      try {
        const { data, error: plotError } = await supabase
          .from("plots")
          .select("id, name, farm_id")
          .eq("farm_id", selectedFarm)
          .order("name", {
            ascending: true,
          });

        if (plotError) {
          console.error("PLOT LOAD ERROR:", plotError);

          if (mounted) {
            setError("Could not load plots.");
          }

          return;
        }

        if (mounted) {
          setPlots(data || []);

          if (data && data.length === 1) {
            setSelectedPlot(data[0].id);
          }
        }
      } catch (err) {
        console.error("LOAD PLOTS ERROR:", err);

        if (mounted) {
          setError("Could not load plots.");
        }
      }
    }

    loadPlots();

    return () => {
      mounted = false;
    };
  }, [selectedFarm]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setError("Please select a JPG, PNG or WebP image.");

      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be smaller than 10 MB.");

      event.target.value = "";
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const url = URL.createObjectURL(file);

    setSelectedFile(file);
    setPreviewUrl(url);

    setError("");
    setMessage("");
    setScanResult(null);

    setChatMessages([]);
    setChatInput("");
    setChatError("");
  }

  // ==========================================================
  // REMOVE IMAGE
  // ==========================================================

  function removeImage() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(null);
    setPreviewUrl("");

    setScanResult(null);

    setMessage("");
    setError("");

    setChatMessages([]);
    setChatInput("");
    setChatError("");
  }

  // ==========================================================
  // LOCATION
  // ==========================================================

  function getLocation() {
    setError("");
    setLocationLoading(true);

    if (!navigator.geolocation) {
      setLocationLoading(false);

      setError("Location is not supported by this browser.");

      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);

        setLongitude(position.coords.longitude);

        setLocationLoading(false);
      },

      () => {
        setLocationLoading(false);

        setError("Could not get your location. Please allow location access.");
      },

      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  }

  // ==========================================================
  // SUBMIT SCAN
  // ==========================================================

  async function submitScan() {
    setError("");
    setMessage("");
    setScanResult(null);

    setChatMessages([]);
    setChatError("");

    if (!selectedFile) {
      setError("Please select a sugarcane leaf image first.");

      return;
    }

    if (!selectedFarm) {
      setError("Please select your farm.");

      return;
    }

    if (!selectedPlot) {
      setError("Please select your plot.");

      return;
    }

    setLoading(true);

    try {
      // ==================================================
      // GET LOGGED-IN USER SESSION
      // ==================================================

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      if (!session) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      // ==================================================
      // FORM DATA
      // ==================================================

      const formData = new FormData();

      // Backend expects "file"
      formData.append("file", selectedFile);

      formData.append("farm_id", selectedFarm);

      formData.append("plot_id", selectedPlot);

      formData.append("language", language);

      if (latitude !== null) {
        formData.append("latitude", latitude.toString());
      }

      if (longitude !== null) {
        formData.append("longitude", longitude.toString());
      }

      const response = await fetch(`${API_URL}/api/scans/create`, {
        method: "POST",

        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },

        body: formData,
      });

      let data: any = null;

      try {
        data = await response.json();
      } catch {
        throw new Error("The server returned an invalid response.");
      }

      if (!response.ok) {
        throw new Error(data?.detail || data?.message || "Crop scan failed.");
      }

      setScanResult(data as ScanResponse);

      setMessage("Crop scan completed successfully.");
    } catch (err) {
      console.error("SCAN ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while analyzing the crop.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function askAssistant(questionOverride?: string) {
    const question = (questionOverride ?? chatInput).trim();

    if (!question) {
      return;
    }

    if (!scanResult) {
      setChatError("Complete a crop scan before asking follow-up questions.");

      return;
    }

    if (chatLoading) {
      return;
    }

    setChatError("");
    setChatInput("");

    const userMessage: ChatMessage = {
      role: "user",
      content: question,
    };

    const previousMessages = [...chatMessages];

    setChatMessages([...previousMessages, userMessage]);

    setChatLoading(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      if (!session) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const response = await fetch(`${API_URL}/api/assistant/chat`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${session.access_token}`,
        },

        body: JSON.stringify({
          question,

          crop: "Sugarcane",

          disease: scanResult.prediction.disease,

          classifier_confidence: scanResult.prediction.confidence,

          language,

          farm_id: scanResult.scan.farm_id ?? selectedFarm,

          plot_id: scanResult.scan.plot_id ?? selectedPlot,

          crop_cycle_id: scanResult.scan.crop_cycle_id ?? undefined,

          scan_id: scanResult.scan_id,

          history: previousMessages,
        }),
      });

      let data: any = null;

      try {
        data = await response.json();
      } catch {
        throw new Error("The assistant returned an invalid response.");
      }

      if (!response.ok) {
        throw new Error(data?.detail || "Crop Assistant failed.");
      }

      const answer = data?.answer?.answer ?? data?.answer ?? data?.response;

      if (!answer || typeof answer !== "string") {
        throw new Error("The assistant returned no answer.");
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: answer,
      };

      setChatMessages((current) => [...current, assistantMessage]);
    } catch (err) {
      setChatMessages((current) => {
        const copy = [...current];

        const lastIndex = copy.length - 1;

        if (copy[lastIndex]?.role === "user") {
          copy.splice(lastIndex, 1);
        }

        return copy;
      });

      setChatInput(question);

      setChatError(
        err instanceof Error ? err.message : "Could not get an answer.",
      );
    } finally {
      setChatLoading(false);
    }
  }

  function handleChatKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      askAssistant();
    }
  }

  function formatDiseaseName(disease: string) {
    if (!disease) {
      return "Unknown";
    }

    return disease.replaceAll("_", " ").replaceAll("-", " ");
  }

  function getConfidenceText(confidence: number) {
    if (confidence >= 0.9) {
      return "High";
    }

    if (confidence >= 0.7) {
      return "Moderate";
    }

    return "Low";
  }

  function formatAdvisoryConfidence(confidence?: string) {
    if (!confidence) {
      return "Not available";
    }

    return confidence.charAt(0).toUpperCase() + confidence.slice(1);
  }

  return (
    <main className="min-h-screen bg-[#07100b] text-white">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        {}

        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link
              href="/dashboard"
              className="mb-3 inline-block text-sm text-white/50 transition hover:text-white"
            >
              ← Back to Dashboard
            </Link>

            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Scan Your Crop
            </h1>

            <p className="mt-2 max-w-2xl text-white/55">
              Take a clear photo of a sugarcane leaf and let KisanX analyze its
              health.
            </p>
          </div>

          <div className="hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-right sm:block">
            <p className="text-xs uppercase tracking-[0.2em] text-orange-400">
              KisanX AI
            </p>

            <p className="mt-1 text-sm text-white/60">Sugarcane Health</p>
          </div>
        </div>

        {}

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          {}

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl sm:p-7">
            <div className="mb-6">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-orange-400">
                Step 01
              </p>

              <h2 className="mt-2 text-xl font-semibold">Add a leaf photo</h2>
            </div>

            {}

            <div className="relative overflow-hidden rounded-3xl border border-dashed border-white/15 bg-black/20">
              {previewUrl ? (
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt="Selected sugarcane leaf"
                    className="h-[360px] w-full object-cover"
                  />

                  {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/65 backdrop-blur-sm">
                      <div className="text-center">
                        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-orange-400" />

                        <p className="font-medium">Analyzing your crop...</p>

                        <p className="mt-1 text-sm text-white/50">
                          KisanX is checking the leaf and preparing your
                          advisory.
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={removeImage}
                    disabled={loading}
                    className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/70 px-4 py-2 text-sm backdrop-blur transition hover:bg-black disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="flex min-h-[360px] cursor-pointer flex-col items-center justify-center px-6 text-center">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/10 text-3xl">
                    🌿
                  </div>

                  <p className="text-lg font-medium">Upload a sugarcane leaf</p>

                  <p className="mt-2 max-w-sm text-sm leading-6 text-white/45">
                    Use a clear photo with the leaf visible and well lit.
                  </p>

                  <span className="mt-6 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-orange-400">
                    Take / Choose Image
                  </span>

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              )}
            </div>

            <p className="mt-3 text-xs text-white/35">
              JPG, PNG or WebP • Maximum 10 MB
            </p>

            {}

            <div className="mt-7 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">Field location</p>

                  <p className="mt-1 text-sm text-white/45">
                    Helps KisanX associate the scan with your field.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={getLocation}
                  disabled={locationLoading || loading}
                  className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium transition hover:bg-white/10 disabled:opacity-50"
                >
                  {locationLoading
                    ? "Getting location..."
                    : latitude !== null
                      ? "✓ Location Added"
                      : "Use My Location"}
                </button>
              </div>

              {latitude !== null && longitude !== null && (
                <p className="mt-3 text-xs text-white/35">
                  GPS: {latitude.toFixed(6)}, {longitude.toFixed(6)}
                </p>
              )}
            </div>
          </section>

          {}

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl sm:p-7">
            <div className="mb-6">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-orange-400">
                Step 02
              </p>

              <h2 className="mt-2 text-xl font-semibold">
                Tell us where this photo came from
              </h2>
            </div>

            {}

            <label className="block">
              <span className="mb-2 block text-sm text-white/70">Farm</span>

              <select
                value={selectedFarm}
                onChange={(event) => {
                  setSelectedFarm(event.target.value);

                  setSelectedPlot("");

                  setScanResult(null);
                  setMessage("");
                  setError("");
                  setChatMessages([]);
                  setChatInput("");
                  setChatError("");
                }}
                disabled={loading}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500/60 disabled:opacity-50"
              >
                <option value="" className="bg-[#07100b]">
                  Select your farm
                </option>

                {farms.map((farm) => (
                  <option
                    key={farm.id}
                    value={farm.id}
                    className="bg-[#07100b]"
                  >
                    {farm.name}
                    {farm.village ? ` — ${farm.village}` : ""}
                  </option>
                ))}
              </select>
            </label>

            {/* PLOT */}

            <label className="mt-5 block">
              <span className="mb-2 block text-sm text-white/70">Plot</span>

              <select
                value={selectedPlot}
                onChange={(event) => setSelectedPlot(event.target.value)}
                disabled={!selectedFarm || loading}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500/60 disabled:opacity-40"
              >
                <option value="" className="bg-[#07100b]">
                  {selectedFarm ? "Select your plot" : "Select a farm first"}
                </option>

                {plots.map((plot) => (
                  <option
                    key={plot.id}
                    value={plot.id}
                    className="bg-[#07100b]"
                  >
                    {plot.name}
                  </option>
                ))}
              </select>
            </label>

            {}

            <label className="mt-5 block">
              <span className="mb-2 block text-sm text-white/70">
                Advisory & chat language
              </span>

              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                disabled={loading}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500/60 disabled:opacity-50"
              >
                <option value="en" className="bg-[#07100b]">
                  English
                </option>

                <option value="hi" className="bg-[#07100b]">
                  हिंदी
                </option>

                <option value="mr" className="bg-[#07100b]">
                  मराठी
                </option>
              </select>
            </label>

            {}

            <div className="mt-7 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-medium">For a better result</p>

              <div className="mt-4 space-y-3">
                {[
                  "Use a clear leaf photo",
                  "Avoid very dark or blurry images",
                  "Show the affected part of the leaf",
                  "Use natural light when possible",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 text-sm text-white/55"
                  >
                    <span className="mt-0.5 text-orange-400">✓</span>

                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {}

            {message && (
              <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-300">
                {message}
              </div>
            )}

            {error && (
              <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">
                {error}
              </div>
            )}

            {}

            {scanResult && (
              <div className="mt-5 space-y-4">
                {}

                <div className="rounded-2xl border border-orange-400/20 bg-orange-400/10 p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-orange-300">
                    AI Crop Analysis
                  </p>

                  <h3 className="mt-3 text-2xl font-semibold">
                    {formatDiseaseName(scanResult.prediction.disease)}
                  </h3>

                  <p className="mt-2 text-sm text-white/45">
                    The model detected a possible crop-health issue from this
                    sugarcane leaf.
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-black/20 p-3">
                      <p className="text-xs text-white/40">Model confidence</p>

                      <p className="mt-1 text-lg font-semibold">
                        {(scanResult.prediction.confidence * 100).toFixed(1)}%
                      </p>

                      <p className="mt-1 text-xs text-white/40">
                        {getConfidenceText(scanResult.prediction.confidence)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-black/20 p-3">
                      <p className="text-xs text-white/40">Disease severity</p>

                      <p className="mt-1 text-lg font-semibold">
                        Not assessed yet
                      </p>

                      <p className="mt-1 text-xs leading-5 text-white/40">
                        This scan does not use a validated severity score.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="text-xs leading-5 text-white/45">
                      ⚠️ This is an AI-assisted prediction. It is not a
                      confirmed laboratory diagnosis.
                    </p>
                  </div>
                </div>

                {}

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-orange-400">
                        KisanX Advisory
                      </p>

                      <h3 className="mt-2 text-lg font-semibold">
                        What you should do
                      </h3>
                    </div>

                    {scanResult.advisory.confidence && (
                      <span className="shrink-0 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/50">
                        Evidence{" "}
                        {formatAdvisoryConfidence(
                          scanResult.advisory.confidence,
                        )}
                      </span>
                    )}
                  </div>

                  <p className="mt-4 whitespace-pre-line text-sm leading-7 text-white/70">
                    {scanResult.advisory.answer}
                  </p>

                  {scanResult.advisory.follow_up_question && (
                    <div className="mt-5 rounded-xl border border-orange-400/20 bg-orange-400/5 p-4">
                      <p className="text-xs uppercase tracking-[0.15em] text-orange-300">
                        KisanX wants to know
                      </p>

                      <p className="mt-2 text-sm leading-6 text-white/65">
                        {scanResult.advisory.follow_up_question}
                      </p>
                    </div>
                  )}
                </div>

                {}

                {scanResult.advisory.evidence &&
                  scanResult.advisory.evidence.length > 0 && (
                    <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                      <summary className="cursor-pointer list-none text-xs uppercase tracking-[0.2em] text-white/40">
                        Evidence used
                      </summary>

                      <div className="mt-4 space-y-3">
                        {scanResult.advisory.evidence.map((item, index) => (
                          <div
                            key={`${item.title}-${index}`}
                            className="rounded-xl border border-white/10 bg-black/20 p-4"
                          >
                            <p className="font-medium">
                              {item.title || `Source ${index + 1}`}
                            </p>

                            {item.source_name && (
                              <p className="mt-1 text-xs text-white/40">
                                {item.source_name}
                              </p>
                            )}

                            {item.source_url && (
                              <a
                                href={item.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-block text-xs text-orange-400 hover:text-orange-300"
                              >
                                View source →
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                {}

                <div className="rounded-2xl border border-orange-400/20 bg-[#0b1710] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-orange-400">
                        Crop Doctor
                      </p>

                      <h3 className="mt-2 text-xl font-semibold">
                        Ask about this scan
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-white/45">
                        Ask follow-up questions about the detected crop issue.
                        KisanX will retrieve agricultural evidence for each
                        question.
                      </p>
                    </div>

                    <div className="hidden rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/40 sm:block">
                      RAG + Gemma
                    </div>
                  </div>

                  {}

                  <div className="mt-5 flex flex-wrap gap-2">
                    {[
                      "What should I check today?",
                      "How can I tell if it is getting worse?",
                      "What action is supported by the evidence?",
                    ].map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => askAssistant(question)}
                        disabled={chatLoading}
                        className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs text-white/55 transition hover:border-orange-400/30 hover:bg-orange-400/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {question}
                      </button>
                    ))}
                  </div>

                  {}

                  {chatMessages.length > 0 && (
                    <div className="mt-5 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                      {chatMessages.map((chatMessage, index) => (
                        <div
                          key={`${chatMessage.role}-${index}`}
                          className={
                            chatMessage.role === "user"
                              ? "flex justify-end"
                              : "flex justify-start"
                          }
                        >
                          <div
                            className={
                              chatMessage.role === "user"
                                ? "max-w-[88%] rounded-2xl rounded-br-md bg-orange-500 px-4 py-3 text-sm leading-6 text-black"
                                : "max-w-[92%] rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white/70"
                            }
                          >
                            {chatMessage.content}
                          </div>
                        </div>
                      ))}

                      {chatLoading && (
                        <div className="flex justify-start">
                          <div className="rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.04] px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 animate-pulse rounded-full bg-orange-400" />

                              <span className="h-2 w-2 animate-pulse rounded-full bg-orange-400 [animation-delay:150ms]" />

                              <span className="h-2 w-2 animate-pulse rounded-full bg-orange-400 [animation-delay:300ms]" />
                            </div>

                            <p className="mt-2 text-xs text-white/35">
                              Checking trusted evidence...
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {}

                  {chatError && (
                    <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-300">
                      {chatError}
                    </div>
                  )}

                  {}

                  <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-2">
                    <textarea
                      value={chatInput}
                      onChange={(event) => setChatInput(event.target.value)}
                      onKeyDown={handleChatKeyDown}
                      disabled={chatLoading}
                      placeholder={
                        language === "hi"
                          ? "इस स्कैन के बारे में कुछ पूछें..."
                          : language === "mr"
                            ? "या स्कॅनबद्दल काही विचारा..."
                            : "Ask anything about this scan..."
                      }
                      rows={3}
                      maxLength={2000}
                      className="w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-white/25 disabled:opacity-50"
                    />

                    <div className="flex items-center justify-between gap-3 border-t border-white/10 px-2 pt-2">
                      <p className="text-[11px] text-white/25">
                        Enter to send • Shift + Enter for a new line
                      </p>

                      <button
                        type="button"
                        onClick={() => askAssistant()}
                        disabled={chatLoading || !chatInput.trim()}
                        className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {chatLoading ? "Thinking..." : "Ask →"}
                      </button>
                    </div>
                  </div>

                  <p className="mt-3 text-center text-[11px] leading-5 text-white/25">
                    KisanX uses retrieved agricultural evidence for each
                    question and avoids unsupported treatment claims.
                  </p>
                </div>
              </div>
            )}

            {}

            <button
              type="button"
              onClick={
                scanResult
                  ? () => {
                      setScanResult(null);
                      setMessage("");
                      setError("");
                      setChatMessages([]);
                      setChatInput("");
                      setChatError("");
                    }
                  : submitScan
              }
              disabled={
                loading ||
                (!scanResult &&
                  (!selectedFile || !selectedFarm || !selectedPlot))
              }
              className="mt-7 w-full rounded-2xl bg-orange-500 px-5 py-4 font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Analyzing Crop..."
                : scanResult
                  ? "Start Another Scan →"
                  : "Analyze Crop →"}
            </button>

            <p className="mt-4 text-center text-xs leading-5 text-white/30">
              KisanX provides AI-assisted crop health analysis. Final
              agricultural decisions should be verified when necessary.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

`

## File: frontend/app/dashboard/farm/new/page.tsx

`tsx
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Language = "en" | "hi" | "mr";

type FormData = {
  farmName: string;
  village: string;
  district: string;
  farmArea: string;
  latitude: string;
  longitude: string;
  plotName: string;
  plotArea: string;
  variety: string;
  cropStage: string;
  plantingDate: string;
  soilType: string;
};

const initialForm: FormData = {
  farmName: "",
  village: "",
  district: "",
  farmArea: "",
  latitude: "",
  longitude: "",
  plotName: "",
  plotArea: "",
  variety: "",
  cropStage: "",
  plantingDate: "",
  soilType: "",
};

const translations = {
  en: {
    language: "English",
    title: "Register Your Farm",
    subtitle:
      "Tell us a little about your field. This helps KisanX understand your crop and give you better advice.",
    farm: "Your Farm",
    farmDescription: "Basic information about your farm.",
    farmName: "What would you like to call your farm?",
    farmNamePlaceholder: "Example: My Sugarcane Farm",
    village: "Village",
    villagePlaceholder: "Enter your village",
    district: "District",
    districtPlaceholder: "Enter your district",
    area: "How big is your field?",
    areaPlaceholder: "Example: 5",
    location: "Where is your field?",
    locationDescription:
      "Use your phone's GPS to automatically find your field location.",
    locationButton: "Use My Location",
    gettingLocation: "Getting Location...",
    latitude: "Latitude",
    longitude: "Longitude",
    plot: "Your Field Section",
    plotDescription:
      "If your farm has different sections, you can name this one.",
    plotName: "What should we call this field section?",
    plotNamePlaceholder: "Example: Main Field",
    plotArea: "How big is this field section?",
    sugarcane: "Your Sugarcane",
    sugarcaneDescription: "A few simple details about your sugarcane.",
    variety: "Which type of sugarcane are you growing?",
    varietyHint: "If you don't know the variety, simply choose 'I don't know'.",
    stage: "How is your sugarcane growing right now?",
    stageHint: "Choose the option that looks closest to your crop.",
    planting: "When did you plant this sugarcane?",
    soil: "What kind of soil is in your field?",
    soilHint: "If you're not sure, choose 'I don't know'.",
    create: "Create My Farm",
    creating: "Creating Your Farm...",
    success: "Your farm has been registered successfully!",
    back: "Back to Dashboard",
    required: "Please fill in all required fields.",
    locationError:
      "We could not get your location. Please allow location access and try again.",
    sessionError: "Your login session has expired. Please sign in again.",
    networkError:
      "Unable to connect to KisanX. Please make sure the KisanX server is running.",
    unknownError: "Something went wrong. Please try again.",
    varieties: {
      co86032: "Co 86032",
      com0265: "CoM 0265",
      co0238: "Co 0238",
      coc671: "CoC 671",
      other: "Other",
      unknown: "I don't know",
    },
    stages: {
      planted: "Just planted",
      small: "Small / still growing",
      growing: "Growing well",
      almost: "Almost ready",
      ready: "Ready for harvest",
      unknown: "I'm not sure",
    },
    soils: {
      black: "Black soil",
      red: "Red soil",
      alluvial: "Alluvial soil",
      laterite: "Laterite soil",
      other: "Other",
      unknown: "I don't know",
    },
  },

  hi: {
    language: "हिंदी",
    title: "अपना खेत दर्ज करें",
    subtitle:
      "अपने खेत के बारे में थोड़ी जानकारी दें। इससे KisanX आपकी फसल को बेहतर समझकर सही सलाह देने में मदद करेगा।",
    farm: "आपका खेत",
    farmDescription: "आपके खेत की सामान्य जानकारी।",
    farmName: "आप अपने खेत का क्या नाम रखना चाहते हैं?",
    farmNamePlaceholder: "उदाहरण: मेरा गन्ने का खेत",
    village: "गाँव",
    villagePlaceholder: "अपने गाँव का नाम लिखें",
    district: "जिला",
    districtPlaceholder: "अपने जिले का नाम लिखें",
    area: "आपका खेत कितना बड़ा है?",
    areaPlaceholder: "उदाहरण: 5",
    location: "आपका खेत कहाँ है?",
    locationDescription:
      "अपने खेत की सही जगह पता करने के लिए फोन का GPS इस्तेमाल करें।",
    locationButton: "मेरी लोकेशन लें",
    gettingLocation: "लोकेशन मिल रही है...",
    latitude: "अक्षांश",
    longitude: "देशांतर",
    plot: "खेत का हिस्सा",
    plotDescription:
      "अगर आपके खेत के अलग-अलग हिस्से हैं, तो इस हिस्से का नाम रख सकते हैं।",
    plotName: "इस खेत के हिस्से का क्या नाम रखें?",
    plotNamePlaceholder: "उदाहरण: मुख्य खेत",
    plotArea: "यह खेत का हिस्सा कितना बड़ा है?",
    sugarcane: "आपकी गन्ने की फसल",
    sugarcaneDescription: "आपकी गन्ने की फसल के बारे में कुछ आसान जानकारी।",
    variety: "आप कौन-सी गन्ने की किस्म उगा रहे हैं?",
    varietyHint: "अगर आपको किस्म का नाम नहीं पता है, तो 'मुझे नहीं पता' चुनें।",
    stage: "अभी आपकी गन्ने की फसल कैसी बढ़ रही है?",
    stageHint: "जो आपकी फसल के सबसे करीब लगे, वह विकल्प चुनें।",
    planting: "आपने यह गन्ना कब लगाया था?",
    soil: "आपके खेत की मिट्टी कैसी है?",
    soilHint: "अगर आपको पता नहीं है, तो 'मुझे नहीं पता' चुनें।",
    create: "मेरा खेत दर्ज करें",
    creating: "खेत दर्ज हो रहा है...",
    success: "आपका खेत सफलतापूर्वक दर्ज हो गया!",
    back: "डैशबोर्ड पर वापस जाएँ",
    required: "कृपया सभी जरूरी जानकारी भरें।",
    locationError:
      "लोकेशन नहीं मिल सकी। कृपया लोकेशन की अनुमति दें और फिर कोशिश करें।",
    sessionError: "आपका लॉगिन समाप्त हो गया है। कृपया दोबारा लॉगिन करें।",
    networkError:
      "KisanX से कनेक्ट नहीं हो पा रहा है। कृपया जांचें कि KisanX सर्वर चल रहा है।",
    unknownError: "कुछ गलत हुआ। कृपया फिर कोशिश करें।",
    varieties: {
      co86032: "Co 86032",
      com0265: "CoM 0265",
      co0238: "Co 0238",
      coc671: "CoC 671",
      other: "अन्य",
      unknown: "मुझे नहीं पता",
    },
    stages: {
      planted: "अभी लगाया है",
      small: "छोटा / अभी बढ़ रहा है",
      growing: "अच्छी तरह बढ़ रहा है",
      almost: "लगभग तैयार",
      ready: "कटाई के लिए तैयार",
      unknown: "मुझे पता नहीं",
    },
    soils: {
      black: "काली मिट्टी",
      red: "लाल मिट्टी",
      alluvial: "जलोढ़ मिट्टी",
      laterite: "लेटराइट मिट्टी",
      other: "अन्य",
      unknown: "मुझे नहीं पता",
    },
  },

  mr: {
    language: "मराठी",
    title: "तुमचे शेत नोंदवा",
    subtitle:
      "तुमच्या शेताबद्दल थोडी माहिती द्या. यामुळे KisanX तुमचे पीक चांगल्या प्रकारे समजून योग्य सल्ला देण्यास मदत करेल.",
    farm: "तुमचे शेत",
    farmDescription: "तुमच्या शेताची प्राथमिक माहिती.",
    farmName: "तुमच्या शेताला कोणते नाव द्यायचे?",
    farmNamePlaceholder: "उदाहरण: माझे ऊसाचे शेत",
    village: "गाव",
    villagePlaceholder: "तुमच्या गावाचे नाव लिहा",
    district: "जिल्हा",
    districtPlaceholder: "तुमच्या जिल्ह्याचे नाव लिहा",
    area: "तुमचे शेत किती मोठे आहे?",
    areaPlaceholder: "उदाहरण: 5",
    location: "तुमचे शेत कुठे आहे?",
    locationDescription:
      "तुमच्या शेताचे अचूक ठिकाण शोधण्यासाठी फोनचा GPS वापरा.",
    locationButton: "माझे स्थान घ्या",
    gettingLocation: "स्थान शोधत आहे...",
    latitude: "अक्षांश",
    longitude: "रेखांश",
    plot: "शेताचा भाग",
    plotDescription:
      "तुमच्या शेताचे वेगवेगळे भाग असल्यास या भागाला नाव देऊ शकता.",
    plotName: "या शेताच्या भागाला कोणते नाव द्यायचे?",
    plotNamePlaceholder: "उदाहरण: मुख्य शेत",
    plotArea: "हा शेताचा भाग किती मोठा आहे?",
    sugarcane: "तुमचे ऊसाचे पीक",
    sugarcaneDescription: "तुमच्या ऊस पिकाबद्दल काही सोपी माहिती.",
    variety: "तुम्ही कोणत्या ऊसाची जात लावली आहे?",
    varietyHint: "जात माहित नसेल तर 'मला माहित नाही' हा पर्याय निवडा.",
    stage: "सध्या तुमचे ऊसाचे पीक कसे वाढत आहे?",
    stageHint: "तुमच्या पिकाला सर्वात जवळचा पर्याय निवडा.",
    planting: "तुम्ही हा ऊस कधी लावला?",
    soil: "तुमच्या शेतातील माती कोणत्या प्रकारची आहे?",
    soilHint: "माहित नसेल तर 'मला माहित नाही' निवडा.",
    create: "माझे शेत नोंदवा",
    creating: "शेत नोंदवत आहे...",
    success: "तुमचे शेत यशस्वीरित्या नोंदवले गेले!",
    back: "डॅशबोर्डवर परत जा",
    required: "कृपया सर्व आवश्यक माहिती भरा.",
    locationError:
      "तुमचे स्थान मिळू शकले नाही. कृपया स्थानाची परवानगी द्या आणि पुन्हा प्रयत्न करा.",
    sessionError: "तुमचे लॉगिन सत्र संपले आहे. कृपया पुन्हा लॉगिन करा.",
    networkError:
      "KisanX शी कनेक्ट होता आले नाही. KisanX सर्व्हर सुरू आहे का ते तपासा.",
    unknownError: "काहीतरी चूक झाली. कृपया पुन्हा प्रयत्न करा.",
    varieties: {
      co86032: "Co 86032",
      com0265: "CoM 0265",
      co0238: "Co 0238",
      coc671: "CoC 671",
      other: "इतर",
      unknown: "मला माहित नाही",
    },
    stages: {
      planted: "नुकतेच लावले",
      small: "लहान / अजून वाढत आहे",
      growing: "चांगले वाढत आहे",
      almost: "कापणीसाठी जवळजवळ तयार",
      ready: "कापणीसाठी तयार",
      unknown: "मला माहित नाही",
    },
    soils: {
      black: "काळी माती",
      red: "लाल माती",
      alluvial: "गाळाची माती",
      laterite: "जांभी माती",
      other: "इतर",
      unknown: "मला माहित नाही",
    },
  },
} as const;

export default function NewFarmPage() {
  const router = useRouter();
  const supabase = createClient();

  const [language, setLanguage] = useState<Language>("en");
  const [form, setForm] = useState<FormData>(initialForm);
  const [locationLoading, setLocationLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const t = translations[language];

  const updateField = (field: keyof FormData, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const getLocation = () => {
    setError("");
    setLocationLoading(true);

    if (!navigator.geolocation) {
      setError(t.locationError);
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));

        setLocationLoading(false);
      },
      () => {
        setError(t.locationError);
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  };

  const submitFarm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");
    setSuccess(false);

    if (
      !form.farmName.trim() ||
      !form.farmArea ||
      !form.plotName.trim() ||
      !form.plotArea
    ) {
      setError(t.required);
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(t.sessionError);
      }

      const payload = {
        farm: {
          name: form.farmName.trim(),
          village: form.village.trim() || null,
          district: form.district.trim() || null,
          latitude: form.latitude ? Number(form.latitude) : null,
          longitude: form.longitude ? Number(form.longitude) : null,
          area_acres: Number(form.farmArea),
        },
        plot: {
          name: form.plotName.trim(),
          area_acres: Number(form.plotArea),
          latitude: form.latitude ? Number(form.latitude) : null,
          longitude: form.longitude ? Number(form.longitude) : null,
          boundary: null,
        },
        crop_cycle: {
          crop_name: "Sugarcane",
          variety: form.variety || null,
          crop_stage: form.cropStage || null,
          planting_date: form.plantingDate || null,
          soil_type: form.soilType || null,
        },
      };

      const response = await fetch("http://127.0.0.1:8000/api/farms/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      let result: {
        detail?: string;
        message?: string;
      } = {};

      try {
        result = await response.json();
      } catch {
        result = {};
      }

      if (!response.ok) {
        throw new Error(result.detail || result.message || t.networkError);
      }

      setSuccess(true);
      setForm(initialForm);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : t.unknownError;

      setError(message.includes("Failed to fetch") ? t.networkError : message);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen bg-[#050806] px-4 py-8 text-white sm:px-6">
        <div className="mx-auto flex min-h-[80vh] max-w-2xl items-center justify-center">
          <div className="w-full rounded-3xl border border-green-400/20 bg-[#0a100c] p-8 text-center sm:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-400/10 text-3xl">
              ✓
            </div>

            <h1 className="mt-6 text-3xl font-semibold">{t.success}</h1>

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="mt-8 rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-black transition hover:bg-orange-400"
            >
              {t.back}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen bg-[#050806] px-4 py-8 text-white sm:px-6 lg:px-8"
      lang={language === "hi" ? "hi" : language === "mr" ? "mr" : "en"}
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-orange-400">
              KisanX
            </p>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {t.title}
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">
              {t.subtitle}
            </p>
          </div>

          <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {(["en", "hi", "mr"] as Language[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setLanguage(item)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  language === item
                    ? "bg-orange-500 text-black"
                    : "text-white/50 hover:text-white"
                }`}
              >
                {translations[item].language}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={submitFarm} className="space-y-6">
          <Section number="01" title={t.farm} description={t.farmDescription}>
            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label={t.farmName}
                placeholder={t.farmNamePlaceholder}
                value={form.farmName}
                onChange={(value) => updateField("farmName", value)}
                required
              />

              <Field
                label={t.area}
                placeholder={t.areaPlaceholder}
                type="number"
                min="0.01"
                step="0.01"
                value={form.farmArea}
                onChange={(value) => updateField("farmArea", value)}
                required
              />

              <Field
                label={t.village}
                placeholder={t.villagePlaceholder}
                value={form.village}
                onChange={(value) => updateField("village", value)}
              />

              <Field
                label={t.district}
                placeholder={t.districtPlaceholder}
                value={form.district}
                onChange={(value) => updateField("district", value)}
              />
            </div>
          </Section>

          <Section
            number="02"
            title={t.location}
            description={t.locationDescription}
          >
            <button
              type="button"
              onClick={getLocation}
              disabled={locationLoading}
              className="rounded-xl border border-orange-400/30 bg-orange-400/10 px-5 py-3 text-sm font-semibold text-orange-300 transition hover:bg-orange-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {locationLoading ? t.gettingLocation : `📍 ${t.locationButton}`}
            </button>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <Field
                label={t.latitude}
                value={form.latitude}
                onChange={(value) => updateField("latitude", value)}
                placeholder="GPS"
              />

              <Field
                label={t.longitude}
                value={form.longitude}
                onChange={(value) => updateField("longitude", value)}
                placeholder="GPS"
              />
            </div>
          </Section>

          <Section number="03" title={t.plot} description={t.plotDescription}>
            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label={t.plotName}
                placeholder={t.plotNamePlaceholder}
                value={form.plotName}
                onChange={(value) => updateField("plotName", value)}
                required
              />

              <Field
                label={t.plotArea}
                type="number"
                min="0.01"
                step="0.01"
                value={form.plotArea}
                onChange={(value) => updateField("plotArea", value)}
                placeholder="Example: 2.5"
                required
              />
            </div>
          </Section>

          <Section
            number="04"
            title={t.sugarcane}
            description={t.sugarcaneDescription}
          >
            <div className="space-y-7">
              <SelectField
                label={t.variety}
                hint={t.varietyHint}
                value={form.variety}
                onChange={(value) => updateField("variety", value)}
                options={[
                  ["Co 86032", t.varieties.co86032],
                  ["CoM 0265", t.varieties.com0265],
                  ["Co 0238", t.varieties.co0238],
                  ["CoC 671", t.varieties.coc671],
                  ["Other", t.varieties.other],
                  ["Unknown", t.varieties.unknown],
                ]}
              />

              <SelectField
                label={t.stage}
                hint={t.stageHint}
                value={form.cropStage}
                onChange={(value) => updateField("cropStage", value)}
                options={[
                  ["Just planted", t.stages.planted],
                  ["Small / still growing", t.stages.small],
                  ["Growing well", t.stages.growing],
                  ["Almost ready", t.stages.almost],
                  ["Ready for harvest", t.stages.ready],
                  ["Unknown", t.stages.unknown],
                ]}
              />

              <Field
                label={t.planting}
                type="date"
                value={form.plantingDate}
                onChange={(value) => updateField("plantingDate", value)}
              />

              <SelectField
                label={t.soil}
                hint={t.soilHint}
                value={form.soilType}
                onChange={(value) => updateField("soilType", value)}
                options={[
                  ["Black soil", t.soils.black],
                  ["Red soil", t.soils.red],
                  ["Alluvial soil", t.soils.alluvial],
                  ["Laterite soil", t.soils.laterite],
                  ["Other", t.soils.other],
                  ["Unknown", t.soils.unknown],
                ]}
              />
            </div>
          </Section>

          {error && (
            <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-4 text-sm leading-6 text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end pb-10">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-orange-500 px-7 py-4 text-sm font-bold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {submitting ? t.creating : `${t.create} →`}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Section({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-[#0a100c] p-6 sm:p-8">
      <div className="mb-7 flex gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-black">
          {number}
        </div>

        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-white/40">{description}</p>
        </div>
      </div>

      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  min,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  min?: string;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium leading-6 text-white/70">
        {label}
        {required && <span className="ml-1 text-orange-400">*</span>}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        min={min}
        step={step}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-orange-400/50 focus:ring-1 focus:ring-orange-400/30"
      />
    </label>
  );
}

function SelectField({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly [string, string][];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium leading-6 text-white/70">
        {label}
      </span>

      {hint && (
        <span className="mb-3 block text-xs leading-5 text-white/30">
          {hint}
        </span>
      )}

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#080c09] px-4 py-3 text-sm text-white outline-none transition focus:border-orange-400/50 focus:ring-1 focus:ring-orange-400/30"
      >
        <option value="">Select an option</option>

        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

`

## File: frontend/ml/cotton/severity_engine.py

`py
from pathlib import Path
import cv2
import numpy as np
from ultralytics import YOLO

MODEL = r"D:\KisanX\frontend\ml\cotton\runs\yolo26n_seg_clean\weights\best.pt"
SOURCE = r"D:\KisanX\frontend\ml\cotton\data\cotton_seg_clean\test\images"

CONF = 0.25

model = YOLO(MODEL)

results = model.predict(
    source=SOURCE,
    imgsz=640,
    conf=CONF,
    device=0,
    verbose=False,
)


def severity_from_score(score):
    if score < 25:
        return "LOW"
    elif score < 50:
        return "MODERATE"
    elif score < 75:
        return "HIGH"
    else:
        return "SEVERE"


print("\n" + "=" * 75)
print("KISANX COTTON AI HEALTH & RISK ENGINE")
print("=" * 75)

for result in results:

    image_name = Path(result.path).name

    print(f"\n{image_name}")
    print("-" * 75)

    if result.masks is None:
        print("Disease/Pest : None detected")
        print("Confidence   : --")
        print("Risk         : LOW")
        print("Status       : NO DETECTION")
        continue

    h, w = result.orig_shape
    image_area = h * w

    masks = result.masks.data.cpu().numpy()
    classes = result.boxes.cls.cpu().numpy().astype(int)
    confidences = result.boxes.conf.cpu().numpy()

    detections = []

    for mask, cls, conf in zip(
        masks,
        classes,
        confidences
    ):

        mask = cv2.resize(
            mask,
            (w, h),
            interpolation=cv2.INTER_NEAREST
        )

        binary = mask > 0.5

        pixels = int(binary.sum())

        class_name = model.names[int(cls)]

        coverage = (
            pixels / image_area
        ) * 100

        detections.append({
            "class": class_name,
            "confidence": float(conf),
            "coverage": coverage,
        })

    # ---------------------------------------------------------
    # HEALTHY CLASS
    # ---------------------------------------------------------

    healthy = [
        d for d in detections
        if d["class"] == "Healthy"
    ]

    diseases = [
        d for d in detections
        if d["class"] != "Healthy"
    ]

    # Strong healthy prediction with no disease detection
    if healthy and not diseases:

        best = max(
            healthy,
            key=lambda x: x["confidence"]
        )

        confidence = best["confidence"]

        if confidence >= 0.80:
            status = "HEALTHY"
            risk = "LOW"
        elif confidence >= 0.50:
            status = "LIKELY HEALTHY"
            risk = "LOW"
        else:
            status = "UNCERTAIN"
            risk = "MODERATE"

        print(f"Disease/Pest : None")
        print(f"Healthy conf : {confidence:.2f}")
        print(f"Risk         : {risk}")
        print(f"Status       : {status}")

        continue

    # ---------------------------------------------------------
    # DISEASE / PEST
    # ---------------------------------------------------------

    if diseases:

        # Highest-confidence disease
        primary = max(
            diseases,
            key=lambda x: x["confidence"]
        )

        confidence = primary["confidence"]

        # Union of disease masks
        disease_union = np.zeros(
            (h, w),
            dtype=bool
        )

        for mask, cls, conf in zip(
            masks,
            classes,
            confidences
        ):

            class_name = model.names[int(cls)]

            if class_name == "Healthy":
                continue

            mask = cv2.resize(
                mask,
                (w, h),
                interpolation=cv2.INTER_NEAREST
            )

            disease_union |= mask > 0.5

        disease_pixels = int(
            disease_union.sum()
        )

        coverage = (
            disease_pixels / image_area
        ) * 100

        # -----------------------------------------------------
        # Prototype severity score
        #
        # IMPORTANT:
        # This is NOT true agronomic damage percentage.
        # -----------------------------------------------------

        coverage_score = min(
            coverage,
            50
        ) / 50 * 50

        confidence_score = confidence * 50

        score = (
            coverage_score +
            confidence_score
        )

        score = min(
            100,
            score
        )

        severity = severity_from_score(score)

        print(
            f"Disease/Pest : {primary['class']}"
        )

        print(
            f"Confidence   : {confidence:.2f}"
        )

        print(
            f"Detection coverage : "
            f"{coverage:.2f}%"
        )

        print(
            f"AI risk score: "
            f"{score:.1f}/100"
        )

        print(
            f"Severity     : "
            f"{severity}"
        )

        if len(diseases) > 1:
            print(
                f"Additional detections: "
                f"{len(diseases) - 1}"
            )

    else:

        print("No disease/pest detected.")
        print("Status: HEALTHY / NO DETECTION")

print("\n" + "=" * 75)

print(
    "NOTE: Detection coverage and AI risk score "
    "are prototype signals, not measured crop-damage percentage."
)

print("=" * 75)
`

## File: crop_cycles.sql

`sql
-- Example crop_cycles CREATE TABLE SQL
CREATE TABLE crop_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
    crop_type VARCHAR(255) NOT NULL,
    planted_at DATE NOT NULL,
    harvested_at DATE,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`

