from typing import Any, Dict, List, Optional

from sentence_transformers import SentenceTransformer


class RAGService:
    def __init__(self):
        print("=" * 60)
        print("Loading KisanX RAG embedding model...")
        print("Model: sentence-transformers/all-MiniLM-L6-v2")

        self.embedding_model = SentenceTransformer(
            "sentence-transformers/all-MiniLM-L6-v2"
        )

        print("RAG embedding model loaded successfully.")
        print("=" * 60)

    def create_embedding(self, text: str) -> List[float]:
        embedding = self.embedding_model.encode(
            text,
            normalize_embeddings=True,
        )

        return embedding.tolist()

    def retrieve(
        self,
        query: str,
        match_count: int = 5,
        crop: Optional[str] = None,
        disease: Optional[str] = None,
    ) -> List[Dict[str, Any]]:

        from app.services.supabase_service import get_server_supabase

        clean_crop = crop.strip().title() if crop and crop.strip() else None

        # Enforce strict cross-crop segregation boundaries
        if clean_crop == "Cotton":
            lower_d = (disease or "").lower()
            lower_q = query.lower()
            if "red rot" in lower_d or "redrot" in lower_d or "mosaic" in lower_d or "sugarcane" in lower_d:
                raise ValueError("Cross-crop rejection: Cotton AI pipeline cannot process Sugarcane knowledge queries.")
            if "sugarcane red rot" in lower_q:
                raise ValueError("Cross-crop rejection: Cotton AI pipeline cannot process Sugarcane knowledge queries.")

        elif clean_crop == "Sugarcane":
            lower_d = (disease or "").lower()
            lower_q = query.lower()
            if "bollworm" in lower_d or "leaf curl" in lower_d or "bacterial blight" in lower_d or "cotton" in lower_d:
                raise ValueError("Cross-crop rejection: Sugarcane AI pipeline cannot process Cotton knowledge queries.")
            if "cotton leaf curl" in lower_q or "cotton bollworm" in lower_q or "cotton bacterial blight" in lower_q:
                raise ValueError("Cross-crop rejection: Sugarcane AI pipeline cannot process Cotton knowledge queries.")

        embedding = self.create_embedding(query)

        supabase = get_server_supabase()

        # 1. Primary retrieval with crop and disease filter
        response = (
            supabase.rpc(
                "match_knowledge_documents",
                {
                    "query_embedding": embedding,
                    "match_count": match_count,
                    "filter_crop": clean_crop,
                    "filter_disease": disease,
                },
            )
            .execute()
        )

        data = response.data or []

        # 2. If exact disease name didn't match (e.g., spacing/casing mismatch), try alternate formats
        if not data and disease:
            alt_disease = disease.replace(" ", "")
            if alt_disease != disease:
                alt_response = (
                    supabase.rpc(
                        "match_knowledge_documents",
                        {
                            "query_embedding": embedding,
                            "match_count": match_count,
                            "filter_crop": clean_crop,
                            "filter_disease": alt_disease,
                        },
                    )
                    .execute()
                )
                data = alt_response.data or []

        # 3. If still empty, fallback to pure vector semantic match on clean_crop (filter_disease=None)
        if not data and clean_crop:
            fallback_response = (
                supabase.rpc(
                    "match_knowledge_documents",
                    {
                        "query_embedding": embedding,
                        "match_count": match_count,
                        "filter_crop": clean_crop,
                        "filter_disease": None,
                    },
                )
                .execute()
            )
            data = fallback_response.data or []

        # Post-retrieval strict crop segregation guarantee
        if clean_crop:
            segregated_docs = []
            for doc in data:
                doc_crop = (doc.get("crop") or "").strip().title()
                # Exclude documents explicitly assigned to another crop
                if doc_crop and doc_crop != clean_crop:
                    continue
                segregated_docs.append(doc)
            return segregated_docs

        return data


rag_service = RAGService()
