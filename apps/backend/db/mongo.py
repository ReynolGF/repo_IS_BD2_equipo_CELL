from functools import lru_cache
from datetime import datetime
from typing import Optional
from apps.backend.core.config import get_settings
from apps.backend.db.enums import SensorType
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection
from pydantic import BaseModel


class SensorReading(BaseModel):
    id_equipment: int
    sensor_type: SensorType
    datetime: datetime
    value: float


@lru_cache
def get_mongo_client() -> AsyncIOMotorClient:
    """Cliente Motor único (pool de conexiones compartido)."""
    settings = get_settings()
    return AsyncIOMotorClient(settings.mongo_db_url)


def get_mongo_db():
    settings = get_settings()
    return get_mongo_client()[settings.mongo_db_name]


def get_readings_collection() -> AsyncIOMotorCollection:
    return get_mongo_db()["sensor_readings"]


async def init_indexes() -> None:
    await get_readings_collection().create_index(
        [("id_equipment", 1), ("sensor_type", 1), ("datetime", -1)]
    )


async def insert_reading(reading: SensorReading) -> None:
    await get_readings_collection().insert_one(reading.model_dump())


async def readings_by_equipment(
    id_equipment: int,
    sensor_type: Optional[SensorType] = None,
    since: Optional[datetime] = None,
    until: Optional[datetime] = None,
    limit: int = 1000,
):
    query: dict = {"id_equipment": id_equipment}
    if sensor_type:
        query["sensor_type"] = sensor_type.value
    if since or until:
        query["datetime"] = {}
        if since:
            query["datetime"]["$gte"] = since
        if until:
            query["datetime"]["$lte"] = until
    cursor = get_readings_collection().find(query).sort("datetime", -1).limit(limit)
    return [doc async for doc in cursor]


async def average_aggregate(
    id_equipment: int, sensor_type: SensorType,
    since: datetime, until: datetime,
):
    pipeline = [
        {"$match": {
            "id_equipment": id_equipment,
            "sensor_type": sensor_type.value,
            "datetime": {"$gte": since, "$lte": until},
        }},
        {"$group": {"_id": None, "average": {"$avg": "$value"}, "total": {"$sum": 1}}},
    ]
    result = await get_readings_collection().aggregate(pipeline).to_list(length=1)
    return result[0] if result else None