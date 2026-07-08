import sys
import os

# Align python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.profile import Profile

def run_update():
    db = SessionLocal()
    try:
        founder_email = "devottamkumar1310@gmail.com"
        profile = db.query(Profile).filter(Profile.email == founder_email).first()
        if profile:
            profile.subscription_status = "founder"
            db.commit()
            print(f"[SUCCESS] Updated {founder_email} to subscription_status='founder'")
        else:
            print(f"[INFO] Profile for {founder_email} does not exist yet. Sync will automatically provision it and client-side bypass will handle it.")
    except Exception as e:
        print(f"[ERROR] Failed to update: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_update()
