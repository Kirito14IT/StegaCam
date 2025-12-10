"""Operation logging utilities."""
from typing import Optional
from sqlalchemy.orm import Session
from .models import OperationLog


def log_operation(
    db: Session,
    operation_type: str,
    user_id: Optional[int] = None,
    operation_detail: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
):
    """Log an operation.
    
    Args:
        db: Database session
        operation_type: Type of operation (e.g., 'register', 'login', 'encode', 'decode')
        user_id: User ID (optional)
        operation_detail: Additional details (optional)
        ip_address: IP address (optional)
        user_agent: User agent string (optional)
    
    Note: This function will not raise exceptions to avoid breaking the main flow.
    """
    try:
        # Truncate user_agent if too long
        if user_agent and len(user_agent) > 500:
            user_agent = user_agent[:500]
        
        log = OperationLog(
            user_id=user_id,
            operation_type=operation_type,
            operation_detail=operation_detail,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.add(log)
        db.commit()
    except Exception as e:
        # Don't raise exception, just log to console
        print(f"Failed to log operation {operation_type}: {e}")
        db.rollback()

