import io
import os
import re
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, status
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from PIL import Image, ImageOps
from sqlalchemy.orm import Session

from .model_runner import runner, global_lock
from .database import get_db, init_db
from .models import User
from .auth import (
    verify_password, get_password_hash, generate_short_id,
    create_access_token, verify_token, get_user_by_email_or_username,
    get_user_by_id, is_email_or_username_taken, SECRET_KEY
)
from .verification import create_verification_code, verify_code
from .logger import log_operation
from fastapi import Request


APP_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODELS_DIR = APP_ROOT / 'server' / 'saved_models'
TMP_DIR = APP_ROOT / 'server' / 'tmp'
TMP_DIR.mkdir(parents=True, exist_ok=True)

MESSAGE_RE = re.compile(r'^[A-Za-z0-9]{7}$')

app = FastAPI(title='ImageProcess Stega API', version='v1')

# Security
security = HTTPBearer()

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    """Initialize database tables on startup."""
    init_db()


def resolve_model_dir(model_name: Optional[str]) -> Path:
    base = DEFAULT_MODELS_DIR
    if model_name:
        model_path = base / model_name
        if not model_path.exists() or not model_path.is_dir():
            raise HTTPException(
                status_code=400,
                detail=f'Model "{model_name}" not found. Available models: {", ".join([p.name for p in base.iterdir() if p.is_dir()])}'
            )
        return model_path
    # fallback: env MODEL_DIR
    env_dir = os.environ.get('MODEL_DIR')
    if env_dir:
        return Path(env_dir)
    # If only one subdir, use it
    subs = [p for p in base.iterdir() if p.is_dir()]
    if len(subs) == 1:
        return subs[0]
    if len(subs) == 0:
        raise HTTPException(status_code=500, detail='No models found in saved_models directory')
    raise HTTPException(
        status_code=400,
        detail=f'MODEL_DIR not set and multiple models found. Please specify model parameter. Available models: {", ".join([p.name for p in subs])}'
    )


class DecodeResponse(BaseModel):
    success: bool
    data: Optional[dict] = None
    error: Optional[str] = None


class RegisterRequest(BaseModel):
    email: EmailStr
    username: Optional[str] = None
    password: str


class LoginRequest(BaseModel):
    email_or_username: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    username: Optional[str]
    short_id: str
    email_verified: bool = False

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class SendCodeRequest(BaseModel):
    email: EmailStr


class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirmRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str


class UpdateProfileRequest(BaseModel):
    username: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


# Authentication dependency
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user from JWT token."""
    token = credentials.credentials
    
    # Strip any whitespace from token
    token = token.strip() if token else None
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证令牌：令牌为空",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = verify_token(token)
    if payload is None:
        # Log token verification failure for debugging
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Token verification failed. Token (first 20 chars): {token[:20] if token else 'None'}...")
        logger.warning(f"SECRET_KEY is set: {bool(SECRET_KEY)}")
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证令牌：令牌验证失败（可能是服务器重启导致密钥变更，请重新登录）",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # JWT 'sub' claim is stored as string, convert to int for database lookup
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证令牌：用户ID缺失",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证令牌：用户ID格式错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = get_user_by_id(db, user_id=user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


@app.get('/api/v1/ping')
def ping():
    return {'ok': True}


@app.post('/api/v1/auth/register', response_model=TokenResponse)
def register(request: RegisterRequest, req: Request, db: Session = Depends(get_db)):
    """Register a new user with email."""
    try:
        # Validate password length
        if len(request.password) < 6:
            raise HTTPException(status_code=400, detail="密码长度至少6位")
        
        # bcrypt has a 72-byte limit, check password byte length
        password_bytes = request.password.encode('utf-8')
        if len(password_bytes) > 72:
            raise HTTPException(
                status_code=400, 
                detail="密码长度不能超过72字节（约72个ASCII字符或更少的中文字符）"
            )
        
        # Validate email format (handled by EmailStr)
        # Check if email or username is taken
        is_taken, reason = is_email_or_username_taken(db, request.email, request.username)
        if is_taken:
            raise HTTPException(status_code=400, detail=reason)
        
        # Generate unique short_id
        max_attempts = 10
        short_id = None
        for _ in range(max_attempts):
            candidate_id = generate_short_id()
            existing = db.query(User).filter(User.short_id == candidate_id).first()
            if not existing:
                short_id = candidate_id
                break
        
        if short_id is None:
            raise HTTPException(status_code=500, detail="生成唯一ID失败，请重试")
        
        # Create user
        password_hash = get_password_hash(request.password)
        user = User(
            email=request.email,
            username=request.username,
            password_hash=password_hash,
            short_id=short_id,
            email_verified=False
        )
        
        try:
            db.add(user)
            db.commit()
            db.refresh(user)
        except Exception as e:
            db.rollback()
            error_msg = str(e)
            # 提取更友好的错误信息
            if "Duplicate entry" in error_msg or "UNIQUE constraint" in error_msg:
                if "email" in error_msg.lower():
                    raise HTTPException(status_code=400, detail="邮箱已被注册")
                elif "username" in error_msg.lower():
                    raise HTTPException(status_code=400, detail="用户名已被使用")
                elif "short_id" in error_msg.lower():
                    # 重试生成short_id
                    raise HTTPException(status_code=500, detail="生成唯一ID失败，请重试")
            raise HTTPException(status_code=500, detail=f"注册失败: {error_msg}")
        
        # Log operation (don't fail registration if logging fails)
        try:
            client_ip = req.client.host if req and req.client else None
            user_agent = req.headers.get('user-agent') if req else None
            log_operation(db, 'register', user.id, f"Email: {request.email}", client_ip, user_agent)
        except Exception as log_error:
            # Log error but don't fail registration
            print(f"Failed to log operation: {log_error}")
        
        # Create access token
        # Note: JWT 'sub' claim must be a string, not an integer
        access_token = create_access_token(data={"sub": str(user.id)})
        
        return TokenResponse(
            access_token=access_token,
            user=UserResponse(
                id=user.id,
                email=user.email,
                username=user.username,
                short_id=user.short_id,
                email_verified=user.email_verified
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"注册失败: {str(e)}")


@app.post('/api/v1/auth/login', response_model=TokenResponse)
def login(request: LoginRequest, req: Request, db: Session = Depends(get_db)):
    """Login with email or username and password."""
    user = get_user_by_email_or_username(db, request.email_or_username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="邮箱/用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not verify_password(request.password, user.password_hash):
        # Log failed login attempt (don't fail if logging fails)
        try:
            client_ip = req.client.host if req and req.client else None
            user_agent = req.headers.get('user-agent') if req else None
            log_operation(db, 'login_failed', user.id, f"Email: {request.email_or_username}", client_ip, user_agent)
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="邮箱/用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Log successful login (don't fail if logging fails)
    try:
        client_ip = req.client.host if req and req.client else None
        user_agent = req.headers.get('user-agent') if req else None
        log_operation(db, 'login', user.id, f"Email: {user.email}", client_ip, user_agent)
    except Exception:
        pass
    
    # Create access token
    # Note: JWT 'sub' claim must be a string, not an integer
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            id=user.id,
            email=user.email,
            username=user.username,
            short_id=user.short_id,
            email_verified=user.email_verified
        )
    )


@app.get('/api/v1/auth/me', response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current authenticated user information."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        short_id=current_user.short_id,
        email_verified=current_user.email_verified
    )


@app.post('/api/v1/auth/send-verification-code')
def send_verification_code(request: SendCodeRequest, db: Session = Depends(get_db)):
    """Send email verification code."""
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="邮箱未注册")
    
    if user.email_verified:
        raise HTTPException(status_code=400, detail="邮箱已验证")
    
    create_verification_code(db, request.email, 'email_verify')
    return {"message": "验证码已发送到您的邮箱"}


@app.post('/api/v1/auth/verify-email')
def verify_email(request: VerifyCodeRequest, db: Session = Depends(get_db)):
    """Verify email with code."""
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="邮箱未注册")
    
    if user.email_verified:
        raise HTTPException(status_code=400, detail="邮箱已验证")
    
    if not verify_code(db, request.email, request.code, 'email_verify'):
        raise HTTPException(status_code=400, detail="验证码无效或已过期")
    
    user.email_verified = True
    db.commit()
    
    log_operation(db, 'email_verified', user.id, f"Email: {request.email}")
    
    return {"message": "邮箱验证成功"}


@app.post('/api/v1/auth/request-password-reset')
def request_password_reset(request: PasswordResetRequest, db: Session = Depends(get_db)):
    """Request password reset code."""
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        # Don't reveal if email exists
        return {"message": "如果邮箱存在，验证码已发送"}
    
    create_verification_code(db, request.email, 'password_reset')
    log_operation(db, 'password_reset_requested', user.id, f"Email: {request.email}")
    
    return {"message": "如果邮箱存在，验证码已发送"}


@app.post('/api/v1/auth/reset-password')
def reset_password(request: PasswordResetConfirmRequest, db: Session = Depends(get_db)):
    """Reset password with verification code."""
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="邮箱未注册")
    
    if not verify_code(db, request.email, request.code, 'password_reset'):
        raise HTTPException(status_code=400, detail="验证码无效或已过期")
    
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="密码长度至少6位")
    
    user.password_hash = get_password_hash(request.new_password)
    db.commit()
    
    log_operation(db, 'password_reset', user.id, f"Email: {request.email}")
    
    return {"message": "密码重置成功"}


@app.put('/api/v1/auth/profile', response_model=UserResponse)
def update_profile(
    request: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user profile."""
    if request.username:
        # Check if username is taken by another user
        existing = db.query(User).filter(
            User.username == request.username,
            User.id != current_user.id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="用户名已被使用")
        current_user.username = request.username
    
    db.commit()
    db.refresh(current_user)
    
    log_operation(db, 'profile_updated', current_user.id, f"Username: {current_user.username}")
    
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        short_id=current_user.short_id,
        email_verified=current_user.email_verified
    )


@app.post('/api/v1/auth/change-password')
def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change password."""
    if not verify_password(request.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="原密码错误")
    
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="新密码长度至少6位")
    
    current_user.password_hash = get_password_hash(request.new_password)
    db.commit()
    
    log_operation(db, 'password_changed', current_user.id, f"Email: {current_user.email}")
    
    return {"message": "密码修改成功"}


@app.get('/api/v1/models')
def list_models():
    base = DEFAULT_MODELS_DIR
    if not base.exists():
        return {'models': []}
    models = [p.name for p in base.iterdir() if p.is_dir()]
    return {'models': models}


@app.post('/api/v1/encode')
def encode_image(
    image: UploadFile = File(...),
    message: str = Form(...),
    model: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    req: Request = None,
):
    if not MESSAGE_RE.match(message):
        raise HTTPException(status_code=400, detail='message must be 7 alphanumeric chars')

    model_dir = resolve_model_dir(model)
    try:
        with global_lock:
            # model_dir 是模型根目录（如 stega/），需要加上 "model" 子目录
            model_path = str(model_dir / "model")
            runner.load(model_path)
            pil_img = Image.open(image.file)
            # Apply EXIF orientation to fix rotation issues
            pil_img = ImageOps.exif_transpose(pil_img)
            im_hidden, im_raw, im_residual = runner.encode(pil_img, message)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'encode failed: {e}')

    # Log operation
    client_ip = req.client.host if req else None
    user_agent = req.headers.get('user-agent') if req else None
    log_operation(db, 'encode', current_user.id, f"Message: {message}, Model: {model}", client_ip, user_agent)

    # PNG-only response
    buf = io.BytesIO()
    im_hidden.save(buf, format='PNG')
    buf.seek(0)

    # Optional debug save
    if os.environ.get('DEBUG_SAVE', '').lower() in ('1', 'true', 'yes'):
        TMP_DIR.mkdir(parents=True, exist_ok=True)
        base = Path(image.filename or 'upload').stem
        im_raw.save(TMP_DIR / f'{base}_raw.png')
        im_hidden.save(TMP_DIR / f'{base}_hidden.png')
        im_residual.save(TMP_DIR / f'{base}_residual.png')

    return StreamingResponse(buf, media_type='image/png')


@app.post('/api/v1/decode', response_model=DecodeResponse)
def decode_image(
    image: UploadFile = File(...),
    model: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    req: Request = None,
):
    model_dir = resolve_model_dir(model)
    try:
        with global_lock:
            # model_dir 是模型根目录（如 stega/），需要加上 "model" 子目录
            model_path = str(model_dir / "model")
            runner.load(model_path)
            pil_img = Image.open(image.file)
            # Apply EXIF orientation to fix rotation issues
            pil_img = ImageOps.exif_transpose(pil_img)
            code = runner.decode(pil_img)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'decode failed: {e}')

    # Log operation
    client_ip = req.client.host if req else None
    user_agent = req.headers.get('user-agent') if req else None
    decoded_message = code.strip() if code else None
    log_operation(db, 'decode', current_user.id, f"Decoded: {decoded_message}, Model: {model}", client_ip, user_agent)

    if code is None:
        return DecodeResponse(success=False, error='未能解析出有效水印信息')
    return DecodeResponse(success=True, data={'message': code.strip(), 'model_used': Path(model_dir).name})
