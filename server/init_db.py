"""Initialize database and create tables."""
from app.database import init_db, engine
from app.models import Base, User, VerificationCode, OperationLog

if __name__ == '__main__':
    print('正在初始化数据库...')
    try:
        # Create all tables
        Base.metadata.create_all(bind=engine)
        print('数据库初始化成功！')
        print('已创建表: users, verification_codes, operation_logs')
    except Exception as e:
        print(f'数据库初始化失败: {e}')
        import sys
        sys.exit(1)

