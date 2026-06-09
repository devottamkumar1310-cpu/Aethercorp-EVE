# ==============================================================================
# PURPOSE: Gemini Embeddings Service.
# DATA FLOW: Takes text input -> queries Gemini API -> returns list of float values (768 dimensions).
# EXTENSION POINTS: Add caching of generated embeddings to avoid redundant LLM calls and costs.
# ARCHITECTURAL DECISION:
# - Standardizes on Gemini `text-embedding-004` returning 768 dimensions.
# - Includes a deterministic mock vector generator to support offline development.
# ==============================================================================

import logging
import hashlib
from typing import List, Optional
from app.core.dependency_container import container

logger = logging.getLogger("eve.memory.embeddings")


class EmbeddingsService:
    """
    Handles generating dense vector representation of texts using Gemini.
    """
    def __init__(self):
        self.gemini_service = container.get("gemini_service")

    def get_embedding(self, text: str) -> List[float]:
        """
        Retrieves embedding vector. Automatically detects and handles mock fallbacks.
        """
        if self.gemini_service.mock_mode:
            return self._generate_mock_embedding(text)

        try:
            # Call Gemini embeddings endpoint
            client = self.gemini_service.client
            
            # Note: embed_content is blocking, we call it synchronously
            response = client.models.embed_content(
                model="text-embedding-004",
                contents=text
            )
            
            # Extract floats list
            embedding = response.embeddings[0].values
            return [float(x) for x in embedding]
            
        except Exception as e:
            logger.error(f"Failed to fetch real Gemini embedding: {e}. Falling back to mock vector.")
            return self._generate_mock_embedding(text)

    def _generate_mock_embedding(self, text: str) -> List[float]:
        """
        Generates a stable, deterministic pseudo-random float vector based on string hash.
        This ensures similarity calculations (dot products) remain functional in mock mode.
        """
        # Create MD5 of string
        hasher = hashlib.md5(text.encode("utf-8"))
        digest = hasher.digest()
        
        # Expand digest to 768 dimensions by repeating and offset scaling
        vector = []
        for i in range(768):
            # Deterministic value based on index and hash bytes
            byte_idx = (i + int(digest[i % 16])) % 16
            val = (digest[byte_idx] / 255.0) * 2.0 - 1.0 # Scale to [-1, 1]
            vector.append(round(val, 5))
            
        return vector


# Register EmbeddingsService inside Container
container.register_singleton("embeddings_service", EmbeddingsService())
