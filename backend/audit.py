"""Shared helper to write audit log entries."""

from datetime import datetime
from sqlalchemy.orm import Session
from models.models import AuditLog


def log_audit(
    db: Session,
    table_name: str,
    action: str,
    description: str,
    record_id: int = None,
    trust_id: int = None,
):
    """Append an audit log row. Does NOT commit — caller must commit."""
    db.add(AuditLog(
        trust_id=trust_id,
        table_name=table_name,
        record_id=record_id,
        action=action,
        description=description,
        timestamp=datetime.utcnow(),
    ))
