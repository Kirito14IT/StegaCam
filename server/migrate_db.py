"""Database migration script to add missing columns."""
from app.database import engine
from sqlalchemy import text

def migrate():
    """Add missing columns to existing tables."""
    with engine.connect() as conn:
        try:
            # Check if email_verified column exists
            result = conn.execute(text("""
                SELECT COUNT(*) as count 
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = 'stegacam_db' 
                AND TABLE_NAME = 'users' 
                AND COLUMN_NAME = 'email_verified'
            """))
            count = result.fetchone()[0]
            
            if count == 0:
                print("添加 email_verified 字段...")
                conn.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN email_verified BOOLEAN DEFAULT FALSE NOT NULL 
                    COMMENT '邮箱是否已验证'
                """))
                conn.commit()
                print("[OK] email_verified 字段已添加")
            else:
                print("[OK] email_verified 字段已存在")
            
            # Check if verification_codes table exists
            result = conn.execute(text("""
                SELECT COUNT(*) as count 
                FROM information_schema.TABLES 
                WHERE TABLE_SCHEMA = 'stegacam_db' 
                AND TABLE_NAME = 'verification_codes'
            """))
            count = result.fetchone()[0]
            
            if count == 0:
                print("创建 verification_codes 表...")
                conn.execute(text("""
                    CREATE TABLE verification_codes (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        email VARCHAR(255) NOT NULL,
                        code VARCHAR(10) NOT NULL,
                        code_type VARCHAR(20) NOT NULL,
                        used BOOLEAN DEFAULT FALSE NOT NULL,
                        expires_at DATETIME NOT NULL,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        INDEX idx_email_type (email, code_type),
                        INDEX idx_code (code)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """))
                conn.commit()
                print("[OK] verification_codes 表已创建")
            else:
                print("[OK] verification_codes 表已存在")
            
            # Check if operation_logs table exists
            result = conn.execute(text("""
                SELECT COUNT(*) as count 
                FROM information_schema.TABLES 
                WHERE TABLE_SCHEMA = 'stegacam_db' 
                AND TABLE_NAME = 'operation_logs'
            """))
            count = result.fetchone()[0]
            
            if count == 0:
                print("创建 operation_logs 表...")
                conn.execute(text("""
                    CREATE TABLE operation_logs (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT NULL,
                        operation_type VARCHAR(50) NOT NULL,
                        operation_detail TEXT NULL,
                        ip_address VARCHAR(45) NULL,
                        user_agent VARCHAR(500) NULL,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        INDEX idx_user_operation (user_id, operation_type),
                        INDEX idx_created_at (created_at),
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """))
                conn.commit()
                print("[OK] operation_logs 表已创建")
            else:
                print("[OK] operation_logs 表已存在")
            
            print("\n数据库迁移完成！")
        except Exception as e:
            print(f"迁移失败: {e}")
            conn.rollback()
            raise

if __name__ == '__main__':
    migrate()

