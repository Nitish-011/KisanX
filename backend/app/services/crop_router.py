from typing import Dict, Any, Callable
from PIL import Image

from app.services.sugarcane_model_service import predict_sugarcane
from app.services.cotton_model_service import predict_cotton

def route_crop_prediction(crop_name: str, image: Image.Image) -> Dict[str, Any]:
    """
    Routes the prediction request to the appropriate crop-specific model.
    """
    crop_name = crop_name.lower().strip()
    
    if crop_name == "sugarcane":
        # Ensure sugarcane prediction matches expected format
        prediction = predict_sugarcane(image)
        prediction["crop"] = "Sugarcane"
        # Sugarcane doesn't have a risk score or severity yet, but we'll add defaults
        if "severity" not in prediction:
            prediction["severity"] = None
        if "risk_score" not in prediction:
            prediction["risk_score"] = None
        if "model" not in prediction:
            prediction["model"] = "MobileNetV3"
        return prediction
        
    elif crop_name == "cotton":
        return predict_cotton(image)
        
    else:
        raise ValueError(f"No active model found for crop: {crop_name}")
