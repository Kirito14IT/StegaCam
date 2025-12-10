"""Authentication utilities."""
import os
import secrets
import string
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Tuple
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from .models import User

# Load environment variables from server/.env
# auth.py is in server/app/, so parent.parent is server/
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# JWT configuration
# IMPORTANT: If JWT_SECRET_KEY is not set, a new random key will be generated on each restart,
# causing all existing tokens to become invalid. Set a fixed key in .env file.
SECRET_KEY = os.getenv('JWT_SECRET_KEY', secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv('JWT_EXPIRE_MINUTES', '10080'))  # Default 7 days

# Password hashing
# Use bcrypt with fallback handling for version compatibility
try:
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
except Exception as e:
    # If bcrypt initialization fails, log warning but continue
    # The error might be about version detection but bcrypt should still work
    import warnings
    warnings.warn(f"bcrypt context initialization warning: {e}")
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password.
    
    Note: bcrypt has a 72-byte limit for passwords. If the password exceeds
    this limit, it will be truncated to 72 bytes (not 72 characters).
    """
    # Convert password to bytes to check length
    password_bytes = password.encode('utf-8')
    
    # bcrypt has a 72-byte limit, truncate if necessary
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
        password = password_bytes.decode('utf-8', errors='ignore')
    
    try:
        return pwd_context.hash(password)
    except Exception as e:
        # If bcrypt fails, try to handle the error gracefully
        error_msg = str(e)
        if "cannot be longer than 72 bytes" in error_msg:
            # Final fallback: truncate to 72 bytes and try again
            password_bytes = password.encode('utf-8')[:72]
            password = password_bytes.decode('utf-8', errors='ignore')
            return pwd_context.hash(password)
        raise


def generate_short_id() -> str:
    """Generate a random 7-character alphanumeric short ID."""
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(7))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[dict]:
    """Verify and decode a JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        # Log the specific error for debugging
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"JWT verification failed: {type(e).__name__}: {str(e)}")
        return None
    except Exception as e:
        # Catch any other unexpected errors
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Unexpected error during JWT verification: {type(e).__name__}: {str(e)}")
        return None


def get_user_by_email_or_username(db: Session, email_or_username: str) -> Optional[User]:
    """Get user by email or username."""
    user = db.query(User).filter(
        (User.email == email_or_username) | (User.username == email_or_username)
    ).first()
    return user


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Get user by ID."""
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_short_id(db: Session, short_id: str) -> Optional[User]:
    """Get user by short ID."""
    return db.query(User).filter(User.short_id == short_id).first()


def is_email_or_username_taken(db: Session, email: str, username: Optional[str] = None) -> Tuple[bool, str]:
    """Check if email or username is already taken.
    
    Returns:
        (is_taken: bool, reason: str)
    """
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        return True, "邮箱已被注册"
    
    if username:
        existing_user = db.query(User).filter(User.username == username).first()
        if existing_user:
            return True, "用户名已被使用"
    
    return False, ""

