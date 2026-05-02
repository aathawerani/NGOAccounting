from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models.models import Tenant, Trust

router = APIRouter(prefix="/api/tenants", tags=["tenants"])


class TenantBody(BaseModel):
    trust_id: int
    name: str
    plot_code: Optional[str] = None
    space_type: Optional[str] = None    # "SHOP" or "FLAT"
    space_number: Optional[str] = None
    monthly_rent: float = 0.0
    water_charge: float = 0.0
    cnic: Optional[str] = None
    last_paid_month: Optional[int] = None
    last_paid_year: Optional[int] = None
    is_active: bool = True


def _serialize(t: Tenant) -> dict:
    return {
        "id": t.id,
        "trust_id": t.trust_id,
        "trust_code": t.trust.code if t.trust else None,
        "trust_name": t.trust.name if t.trust else None,
        "name": t.name,
        "plot_code": t.plot_code,
        "space_type": t.space_type,
        "space_number": t.space_number,
        "monthly_rent": t.monthly_rent,
        "water_charge": t.water_charge,
        "cnic": t.cnic,
        "last_paid_month": t.last_paid_month,
        "last_paid_year": t.last_paid_year,
        "is_active": t.is_active,
    }


@router.get("")
def list_tenants(trust_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(Tenant).options(joinedload(Tenant.trust))
    if trust_id is not None:
        q = q.filter(Tenant.trust_id == trust_id)
    return [_serialize(t) for t in q.order_by(Tenant.name).all()]


@router.post("", status_code=201)
def create_tenant(body: TenantBody, db: Session = Depends(get_db)):
    if not db.query(Trust).filter(Trust.id == body.trust_id).first():
        raise HTTPException(status_code=404, detail="Trust not found")
    tenant = Tenant(**body.model_dump())
    db.add(tenant)
    db.commit()
    tenant = (
        db.query(Tenant)
        .options(joinedload(Tenant.trust))
        .filter(Tenant.id == tenant.id)
        .first()
    )
    return _serialize(tenant)


@router.put("/{tenant_id}")
def update_tenant(tenant_id: int, body: TenantBody, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if not db.query(Trust).filter(Trust.id == body.trust_id).first():
        raise HTTPException(status_code=404, detail="Trust not found")
    for k, v in body.model_dump().items():
        setattr(tenant, k, v)
    db.commit()
    tenant = (
        db.query(Tenant)
        .options(joinedload(Tenant.trust))
        .filter(Tenant.id == tenant_id)
        .first()
    )
    return _serialize(tenant)


@router.delete("/{tenant_id}", status_code=204)
def delete_tenant(tenant_id: int, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    db.delete(tenant)
    db.commit()
