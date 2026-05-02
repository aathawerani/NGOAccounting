from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.models import MajlisBill, Trust

router = APIRouter(prefix="/api/majlis", tags=["majlis"])


class MajlisBillBody(BaseModel):
    trust_id: int
    date: date
    hijri_day: Optional[str] = None
    hijri_month: Optional[str] = None
    hijri_year: Optional[str] = None
    from_time: Optional[str] = None
    to_time: Optional[str] = None
    event_name: Optional[str] = None
    milk_qty: float = 0.0
    milk_price: float = 0.0
    sugar_qty: float = 0.0
    sugar_price: float = 0.0
    tea_qty: float = 0.0
    tea_price: float = 0.0
    saffron: float = 0.0
    cardamoms: float = 0.0
    pistachios: float = 0.0
    ice: float = 0.0
    essence: float = 0.0
    miscellaneous: float = 0.0
    miscellaneous_desc: Optional[str] = None
    lights_fans: float = 0.0
    gas: float = 0.0
    loud_speaker: float = 0.0
    molana: float = 0.0


def _next_serial(trust_id: int, db: Session) -> str:
    last = (
        db.query(MajlisBill)
        .filter(MajlisBill.trust_id == trust_id)
        .order_by(MajlisBill.id.desc())
        .first()
    )
    if not last or not last.serial_no:
        return "001"
    try:
        num = int(last.serial_no)
        return f"{(num % 999) + 1:03d}"
    except ValueError:
        return "001"


def _serialize(b: MajlisBill) -> dict:
    return {
        "id": b.id,
        "trust_id": b.trust_id,
        "date": b.date.isoformat() if b.date else None,
        "hijri_day": b.hijri_day,
        "hijri_month": b.hijri_month,
        "hijri_year": b.hijri_year,
        "serial_no": b.serial_no,
        "from_time": b.from_time,
        "to_time": b.to_time,
        "event_name": b.event_name,
        "milk_qty": b.milk_qty,
        "milk_price": b.milk_price,
        "milk_total": b.milk_total,
        "sugar_qty": b.sugar_qty,
        "sugar_price": b.sugar_price,
        "sugar_total": b.sugar_total,
        "tea_qty": b.tea_qty,
        "tea_price": b.tea_price,
        "tea_total": b.tea_total,
        "saffron": b.saffron,
        "cardamoms": b.cardamoms,
        "pistachios": b.pistachios,
        "ice": b.ice,
        "essence": b.essence,
        "miscellaneous": b.miscellaneous,
        "miscellaneous_desc": b.miscellaneous_desc,
        "lights_fans": b.lights_fans,
        "gas": b.gas,
        "loud_speaker": b.loud_speaker,
        "molana": b.molana,
        "total_amount": b.total_amount,
    }


@router.get("")
def list_bills(trust_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(MajlisBill)
    if trust_id is not None:
        q = q.filter(MajlisBill.trust_id == trust_id)
    return [_serialize(b) for b in q.order_by(MajlisBill.date.desc(), MajlisBill.id.desc()).all()]


@router.get("/next-serial")
def next_serial(trust_id: int, db: Session = Depends(get_db)):
    return {"serial_no": _next_serial(trust_id, db)}


@router.post("", status_code=201)
def create_bill(body: MajlisBillBody, db: Session = Depends(get_db)):
    if not db.query(Trust).filter(Trust.id == body.trust_id).first():
        raise HTTPException(status_code=404, detail="Trust not found")

    milk_total = body.milk_qty * body.milk_price
    sugar_total = body.sugar_qty * body.sugar_price
    tea_total = body.tea_qty * body.tea_price
    total = (
        milk_total + sugar_total + tea_total
        + body.saffron + body.cardamoms + body.pistachios
        + body.ice + body.essence + body.miscellaneous
        + body.lights_fans + body.gas + body.loud_speaker + body.molana
    )

    bill = MajlisBill(
        trust_id=body.trust_id,
        date=body.date,
        hijri_day=body.hijri_day,
        hijri_month=body.hijri_month,
        hijri_year=body.hijri_year,
        serial_no=_next_serial(body.trust_id, db),
        from_time=body.from_time,
        to_time=body.to_time,
        event_name=body.event_name,
        milk_qty=body.milk_qty,
        milk_price=body.milk_price,
        milk_total=milk_total,
        sugar_qty=body.sugar_qty,
        sugar_price=body.sugar_price,
        sugar_total=sugar_total,
        tea_qty=body.tea_qty,
        tea_price=body.tea_price,
        tea_total=tea_total,
        saffron=body.saffron,
        cardamoms=body.cardamoms,
        pistachios=body.pistachios,
        ice=body.ice,
        essence=body.essence,
        miscellaneous=body.miscellaneous,
        miscellaneous_desc=body.miscellaneous_desc,
        lights_fans=body.lights_fans,
        gas=body.gas,
        loud_speaker=body.loud_speaker,
        molana=body.molana,
        total_amount=total,
    )
    db.add(bill)
    db.commit()
    db.refresh(bill)
    return _serialize(bill)


@router.delete("/{bill_id}", status_code=204)
def delete_bill(bill_id: int, db: Session = Depends(get_db)):
    bill = db.query(MajlisBill).filter(MajlisBill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    db.delete(bill)
    db.commit()
