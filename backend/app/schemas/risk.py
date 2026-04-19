from pydantic import BaseModel


class BBoxRequest(BaseModel):
    minx: float
    miny: float
    maxx: float
    maxy: float


class RiskResponse(BaseModel):
    geojson: dict
    matrix: list[list[float]]
