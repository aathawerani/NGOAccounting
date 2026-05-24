from datetime import datetime as _dt
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from database import SessionLocal
from models.models import Trust, TrustSettings

router = APIRouter(prefix="/api/trust-settings", tags=["trust-settings"])


class TrustSettingsBody(BaseModel):
    address: Optional[str] = None
    default_water_charge: Optional[float] = None
    fiscal_year: Optional[int] = None
    logo_base64: Optional[str] = None


@router.get("/{trust_id}")
def get_trust_settings(trust_id: int):
    db = SessionLocal()
    try:
        trust = db.query(Trust).filter(Trust.id == trust_id).first()
        if not trust:
            raise HTTPException(status_code=404, detail="Trust not found")
        settings = db.query(TrustSettings).filter(
            TrustSettings.trust_id == trust_id
        ).first()
        return _to_dict(trust, settings)
    finally:
        db.close()


@router.post("/{trust_id}")
def save_trust_settings(trust_id: int, body: TrustSettingsBody):
    db = SessionLocal()
    try:
        trust = db.query(Trust).filter(Trust.id == trust_id).first()
        if not trust:
            raise HTTPException(status_code=404, detail="Trust not found")

        settings = db.query(TrustSettings).filter(
            TrustSettings.trust_id == trust_id
        ).first()
        if not settings:
            settings = TrustSettings(trust_id=trust_id)
            db.add(settings)

        if body.address is not None:
            settings.address = body.address
        if body.default_water_charge is not None:
            settings.default_water_charge = body.default_water_charge
        if body.fiscal_year is not None:
            settings.fiscal_year = body.fiscal_year
        if body.logo_base64 is not None:
            settings.logo_base64 = body.logo_base64
        settings.updated_at = _dt.utcnow()

        db.commit()
        db.refresh(settings)
        return _to_dict(trust, settings)
    finally:
        db.close()


def _to_dict(trust: Trust, settings: Optional[TrustSettings]):
    return {
        "trust_id": trust.id,
        "trust_name": trust.name,
        "trust_code": trust.code,
        "address": settings.address if settings else None,
        "default_water_charge": settings.default_water_charge if settings else 0.0,
        "fiscal_year": settings.fiscal_year if settings else None,
        "logo_base64": settings.logo_base64 if settings else None,
        "updated_at": settings.updated_at.isoformat() if (settings and settings.updated_at) else None,
    }
