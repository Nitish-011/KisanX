"""
Backward compatibility proxy module.
Delegates directly to app.services.sugarcane_model_service.
"""
from app.services.sugarcane_model_service import (
    CropDiseaseModel,
    crop_disease_model,
    predict_sugarcane_disease,
)

__all__ = ["CropDiseaseModel", "crop_disease_model", "predict_sugarcane_disease"]
