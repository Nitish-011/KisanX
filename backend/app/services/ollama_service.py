import json
from typing import Any, Dict, Optional

import httpx

from app.config import settings


class OllamaService:

    def __init__(self):

        self.base_url = (
            settings.ollama_base_url
            .rstrip("/")
        )

        self.model = settings.ollama_model

    async def _request(
        self,
        system_prompt: str,
        user_prompt: str,
        schema: Optional[Dict[str, Any]],
    ) -> str:

        payload: Dict[str, Any] = {
            "model": self.model,
            "stream": False,

            "messages": [
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_prompt,
                },
            ],

            "options": {
                "temperature": 0,
            },
        }

        if schema:

            payload["format"] = schema

        else:

            payload["format"] = "json"

        async with httpx.AsyncClient(
            timeout=120.0
        ) as client:

            response = await client.post(
                f"{self.base_url}/api/chat",
                json=payload,
            )

            response.raise_for_status()

            data = response.json()

        message = data.get(
            "message",
            {},
        )

        return message.get(
            "content",
            "",
        ).strip()

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> str:
        return await self._request(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            schema=None,
        )

    async def generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
        schema: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:

        content = await self._request(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            schema=schema,
        )

        try:

            parsed = json.loads(
                content
            )

            if isinstance(parsed, dict):

                return parsed

        except json.JSONDecodeError:
            pass

        retry_system_prompt = (
            system_prompt
            + "\n\n"
            + "CRITICAL OUTPUT REQUIREMENT:\n"
            + "Return ONLY valid JSON.\n"
            + "Do not include Markdown.\n"
            + "Do not include explanations outside JSON.\n"
            + "Do not write source numbers inside the answer text.\n"
            + "Follow the supplied JSON schema exactly."
        )

        retry_user_prompt = (
            user_prompt
            + "\n\n"
            + "IMPORTANT:\n"
            + "Your previous output was invalid JSON.\n"
            + "Generate the response again as valid JSON only."
        )

        retry_content = await self._request(
            system_prompt=retry_system_prompt,
            user_prompt=retry_user_prompt,
            schema=schema,
        )

        try:

            parsed = json.loads(
                retry_content
            )

            if isinstance(parsed, dict):

                return parsed

        except json.JSONDecodeError:

            pass

        return {
            "error": "Ollama returned invalid JSON.",
            "raw_response": retry_content,
        }


ollama_service = OllamaService()
