"""Database models."""
from sqlalchemy import Column, Integer, String, DateTime, Index, Boolean, Text, ForeignKey
from sqlalchemy.sql import func
from .database import Base


class User(Base):
    """User model."""
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False, comment='邮箱地址')
    username = Column(String(100), nullable=True, comment='用户名')
    password_hash = Column(String(255), nullable=False, comment='密码哈希')
    short_id = Column(String(7), unique=True, index=True, nullable=False, comment='唯一短ID')
    email_verified = Column(Boolean, default=False, nullable=False, comment='邮箱是否已验证')
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, comment='创建时间')
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False, comment='更新时间')

    # Indexes
    __table_args__ = (
        Index('idx_email', 'email'),
        Index('idx_short_id', 'short_id'),
    )

    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, username={self.username}, short_id={self.short_id})>"


class VerificationCode(Base):
    """Email verification and password reset code model."""
    __tablename__ = 'verification_codes'

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), nullable=False, index=True, comment='邮箱地址')
    code = Column(String(10), nullable=False, comment='验证码')
    code_type = Column(String(20), nullable=False, comment='验证码类型: email_verify, password_reset')
    used = Column(Boolean, default=False, nullable=False, comment='是否已使用')
    expires_at = Column(DateTime(timezone=True), nullable=False, comment='过期时间')
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, comment='创建时间')

    # Indexes
    __table_args__ = (
        Index('idx_email_type', 'email', 'code_type'),
        Index('idx_code', 'code'),
    )

    def __repr__(self):
        return f"<VerificationCode(id={self.id}, email={self.email}, code_type={self.code_type}, used={self.used})>"


class OperationLog(Base):
    """Operation log model."""
    __tablename__ = 'operation_logs'

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True, comment='用户ID')
    operation_type = Column(String(50), nullable=False, index=True, comment='操作类型')
    operation_detail = Column(Text, nullable=True, comment='操作详情')
    ip_address = Column(String(45), nullable=True, comment='IP地址')
    user_agent = Column(String(500), nullable=True, comment='用户代理')
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True, comment='创建时间')

    # Indexes
    __table_args__ = (
        Index('idx_user_operation', 'user_id', 'operation_type'),
        Index('idx_created_at', 'created_at'),
    )

    def __repr__(self):
        return f"<OperationLog(id={self.id}, user_id={self.user_id}, operation_type={self.operation_type})>"

