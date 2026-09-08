import requests
import io
from PIL import Image

img = Image.new("RGB", (100, 100), color=(50, 150, 50))
buf = io.BytesIO()
img.save(buf, format="JPEG")
img_bytes = buf.getvalue()

data = {
    'crop_name': 'Cotton',
    'farm_area_acres': '3.5',
    'variety': 'Bt Cotton Hybrid',
    'farm_name': 'Vidarbha Agri Estates',
    'village': 'Nagpur Rural',
    'district': 'Nagpur, Maharashtra',
    'latitude': '21.1458',
    'longitude': '79.0882'
}
files = {
    'file': ('test_harvest.jpg', img_bytes, 'image/jpeg')
}

r = requests.post('http://127.0.0.1:8000/api/marketplace/analyze-harvest', data=data, files=files)
print(r.status_code)
print(r.text)
