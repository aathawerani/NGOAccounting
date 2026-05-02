from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.models import Plot

router = APIRouter(prefix="/api/plots", tags=["plots"])


@router.get("")
def list_plots(trust_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(Plot)
    if trust_id is not None:
        q = q.filter(Plot.trust_id == trust_id)
    return [{"id": p.id, "trust_id": p.trust_id, "code": p.code}
            for p in q.order_by(Plot.code).all()]
