"""Verification code management."""
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_
from .models import VerificationCode
from .email_service import generate_verification_code, send_verification_email


def create_verification_code(
    db: Session,
    email: str,
    code_type: str,
    expires_minutes: int = 10
) -> str:
    """Create and send a verification code.
    
    Args:
        db: Database session
        email: Email address
        code_type: Type of code (email_verify or password_reset)
        expires_minutes: Expiration time in minutes
    
    Returns:
        The generated verification code
    """
    # Invalidate old unused codes for this email and type
    db.query(VerificationCode).filter(
        and_(
            VerificationCode.email == email,
            VerificationCode.code_type == code_type,
            VerificationCode.used == False,
            VerificationCode.expires_at > datetime.utcnow()
        )
    ).update({"used": True})
    
    # Generate new code
    code = generate_verification_code()
    expires_at = datetime.utcnow() + timedelta(minutes=expires_minutes)
    
    verification_code = VerificationCode(
        email=email,
        code=code,
        code_type=code_type,
        expires_at=expires_at
    )
    
    db.add(verification_code)
    db.commit()
    
    # Send email
    send_verification_email(email, code, code_type)
    
    return code


def verify_code(
    db: Session,
    email: str,
    code: str,
    code_type: str
) -> bool:
    """Verify a verification code.
    
    Args:
        db: Database session
        email: Email address
        code: Verification code
        code_type: Type of code
    
    Returns:
        True if valid, False otherwise
    """
    verification = db.query(VerificationCode).filter(
        and_(
            VerificationCode.email == email,
            VerificationCode.code == code,
            VerificationCode.code_type == code_type,
            VerificationCode.used == False,
            VerificationCode.expires_at > datetime.utcnow()
        )
    ).first()
    
    if verification:
        verification.used = True
        db.commit()
        return True
    
    return False


def get_latest_code(db: Session, email: str, code_type: str) -> Optional[VerificationCode]:
    """Get the latest unused verification code for an email."""
    return db.query(VerificationCode).filter(
        and_(
            VerificationCode.email == email,
            VerificationCode.code_type == code_type,
            VerificationCode.used == False,
            VerificationCode.expires_at > datetime.utcnow()
        )
    ).order_by(VerificationCode.created_at.desc()).first()

