from fastapi import APIRouter

from app.schemas.risk import BBoxRequest, RiskResponse

router = APIRouter()


@router.post("/risk", response_model=RiskResponse)
async def risk(bbox: BBoxRequest) -> RiskResponse:
    geo = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [bbox.minx, bbox.miny],
                        [bbox.maxx, bbox.miny],
                        [bbox.maxx, bbox.maxy],
                        [bbox.minx, bbox.maxy],
                        [bbox.minx, bbox.miny],
                    ]],
                },
                "properties": {"risk": 0.5},
            }
        ],
    }

    matrix = [
        [0.1, 0.2, 0.3],
        [0.2, 0.5, 0.2],
        [0.1, 0.3, 0.4],
    ]

    return RiskResponse(geojson=geo, matrix=matrix)
