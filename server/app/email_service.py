"""Email service for sending verification codes."""
import os
import smtplib
import secrets
import string
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Email configuration
SMTP_HOST = os.getenv('SMTP_HOST', 'smtp.qq.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
SMTP_USER = os.getenv('SMTP_USER', '')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')
SMTP_FROM = os.getenv('SMTP_FROM', SMTP_USER)


def generate_verification_code(length: int = 6) -> str:
    """Generate a random numeric verification code."""
    return ''.join(secrets.choice(string.digits) for _ in range(length))


def send_verification_email(email: str, code: str, code_type: str = 'email_verify') -> bool:
    """Send verification code email.
    
    Args:
        email: Recipient email address
        code: Verification code
        code_type: Type of code (email_verify or password_reset)
    
    Returns:
        True if sent successfully, False otherwise
    """
    if not SMTP_USER or not SMTP_PASSWORD:
        # If SMTP not configured, just log and return True (for development)
        print(f"[DEV MODE] Verification code for {email}: {code} (type: {code_type})")
        return True
    
    try:
        if code_type == 'email_verify':
            subject = 'StegaCam 邮箱验证'
            body = f"""
尊敬的用户，

您的邮箱验证码是：{code}

验证码有效期为10分钟，请勿泄露给他人。

如果这不是您的操作，请忽略此邮件。

StegaCam 团队
"""
        else:  # password_reset
            subject = 'StegaCam 密码重置验证码'
            body = f"""
尊敬的用户，

您的密码重置验证码是：{code}

验证码有效期为10分钟，请勿泄露给他人。

如果这不是您的操作，请立即修改密码。

StegaCam 团队
"""
        
        msg = MIMEMultipart()
        msg['From'] = SMTP_FROM
        msg['To'] = email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain', 'utf-8'))
        
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False

