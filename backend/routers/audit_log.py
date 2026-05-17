from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.models import AuditLog

router = APIRouter(prefix="/api/audit-log", tags=["audit-log"])


@router.get("")
def list_audit_log(
    trust_id: Optional[int] = None,
    table: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog)
    if trust_id is not None:
        q = q.filter(AuditLog.trust_id == trust_id)
    if table:
        q = q.filter(AuditLog.table_name == table)
    if action:
        q = q.filter(AuditLog.action == action)
    total = q.count()
    rows = q.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
    return {
        "total": total,
        "rows": [
            {
                "id":          r.id,
                "trust_id":    r.trust_id,
                "table_name":  r.table_name,
                "record_id":   r.record_id,
                "action":      r.action,
                "description": r.description,
                "timestamp":   r.timestamp.isoformat() if r.timestamp else None,
            }
            for r in rows
        ],
    }
