import asyncio
from fastapi import APIRouter, HTTPException
import httpx
from app.core.config import settings

router = APIRouter()

OPENWEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5"

VIETNAM_CITIES = [
    {"name": "Hà Nội",       "lat": 21.028, "lng": 105.804},
    {"name": "TP.HCM",       "lat": 10.823, "lng": 106.629},
    {"name": "Đà Nẵng",      "lat": 16.054, "lng": 108.202},
    {"name": "Huế",          "lat": 16.463, "lng": 107.591},
    {"name": "Cần Thơ",      "lat": 10.045, "lng": 105.748},
    {"name": "Nha Trang",    "lat": 12.238, "lng": 109.196},
    {"name": "Hải Phòng",    "lat": 20.865, "lng": 106.683},
    {"name": "Vinh",         "lat": 18.679, "lng": 105.682},
    {"name": "Đà Lạt",       "lat": 11.940, "lng": 108.458},
    {"name": "Quy Nhơn",     "lat": 13.776, "lng": 109.223},
    {"name": "Buôn Ma Thuột","lat": 12.667, "lng": 108.050},
    {"name": "Rạch Giá",     "lat":  9.975, "lng": 105.080},
]


async def _fetch_city(client: httpx.AsyncClient, city: dict, api_key: str) -> dict:
    try:
        weather_url = (
            f"{OPENWEATHER_BASE_URL}/weather"
            f"?lat={city['lat']}&lon={city['lng']}&appid={api_key}&units=metric"
        )
        pollution_url = (
            f"{OPENWEATHER_BASE_URL}/air_pollution"
            f"?lat={city['lat']}&lon={city['lng']}&appid={api_key}"
        )
        weather_resp, pollution_resp = await asyncio.gather(
            client.get(weather_url),
            client.get(pollution_url),
        )
        weather_data = weather_resp.json()
        pollution_data = pollution_resp.json()

        wind = weather_data.get("wind", {})
        main = weather_data.get("main", {})
        plist = pollution_data.get("list", [])
        pm25 = plist[0]["components"].get("pm2_5", 0) if plist else 0
        aqi  = plist[0]["main"].get("aqi", 0) if plist else 0

        return {
            **city,
            "wind_speed": wind.get("speed", 0),
            "wind_deg":   wind.get("deg", 0),
            "temp":       main.get("temp", 0),
            "humidity":   main.get("humidity", 0),
            "pm2_5":      pm25,
            "aqi":        aqi,
        }
    except Exception as exc:
        return {**city, "error": str(exc)}


@router.get("/current")
async def get_environment_data(lat: float, lng: float):
    if not settings.openweathermap_api_key:
        raise HTTPException(status_code=500, detail="OpenWeatherMap API key not configured")

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            weather_url = (
                f"{OPENWEATHER_BASE_URL}/weather"
                f"?lat={lat}&lon={lng}&appid={settings.openweathermap_api_key}&units=metric"
            )
            pollution_url = (
                f"{OPENWEATHER_BASE_URL}/air_pollution"
                f"?lat={lat}&lon={lng}&appid={settings.openweathermap_api_key}"
            )
            weather_resp, pollution_resp = await asyncio.gather(
                client.get(weather_url),
                client.get(pollution_url),
            )
            weather_resp.raise_for_status()
            pollution_resp.raise_for_status()

            weather_data   = weather_resp.json()
            pollution_data = pollution_resp.json()

            wind   = weather_data.get("wind", {})
            main   = weather_data.get("main", {})
            plist  = pollution_data.get("list", [])
            pm25   = plist[0]["components"].get("pm2_5", 0) if plist else 0
            aqi    = plist[0]["main"].get("aqi", 0) if plist else 0

            return {
                "wind":     {"speed": wind.get("speed", 0), "deg": wind.get("deg", 0)},
                "weather":  {"temp":  main.get("temp", 0),  "humidity": main.get("humidity", 0)},
                "pollution":{"pm2_5": pm25, "aqi": aqi},
            }

        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"OpenWeatherMap error: {e.response.text}",
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


@router.get("/vietnam")
async def get_vietnam_env():
    """Fetch env data for major Vietnamese cities in parallel."""
    if not settings.openweathermap_api_key:
        raise HTTPException(status_code=500, detail="OpenWeatherMap API key not configured")

    async with httpx.AsyncClient(timeout=15) as client:
        results = await asyncio.gather(
            *[_fetch_city(client, city, settings.openweathermap_api_key) for city in VIETNAM_CITIES]
        )
    return list(results)
