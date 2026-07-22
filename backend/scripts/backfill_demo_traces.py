import sys
import os

# Add the backend directory to sys.path so we can import from app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.organization import Organization
from app.commands.seed_scenarios import seed_demo_recommendation_traces
from app.models.recommendation_trace import RecommendationTrace

def backfill_traces():
    db = SessionLocal()
    try:
        # Get all demo orgs that match slugs or have the demo base slugs
        orgs = db.query(Organization).filter(
            Organization.slug.like("luma%")
        ).all()
        orgs.extend(db.query(Organization).filter(Organization.slug.like("drift%")).all())
        orgs.extend(db.query(Organization).filter(Organization.slug.like("basecamp%")).all())
        
        print(f"Found {len(orgs)} potential demo organizations to backfill.")
        
        for org in orgs:
            # Check if traces already exist for this org
            existing_traces = db.query(RecommendationTrace).filter(RecommendationTrace.organization_id == org.id).count()
            
            if existing_traces == 0:
                print(f"[{org.name} - {org.slug}] No traces found. Backfilling...")
                try:
                    seed_demo_recommendation_traces(db, org.id)
                    db.commit()
                    print(f"[{org.name} - {org.slug}] Successfully seeded traces.")
                except Exception as e:
                    db.rollback()
                    print(f"[{org.name} - {org.slug}] Error seeding traces: {e}")
            else:
                print(f"[{org.name} - {org.slug}] Traces already exist ({existing_traces}). Skipping.")
                
        print("\nBackfill completed successfully.")
        
    except Exception as e:
        print(f"Failed to backfill: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    backfill_traces()
