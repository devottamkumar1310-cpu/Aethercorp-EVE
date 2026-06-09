from sqlalchemy.orm import Session
from app.services.risk_detection_service import detect_risks
from app.services.opportunity_service import detect_opportunities
from datetime import datetime
from app.models.task import Task
from app.models.project import Project

def generate_actions(db: Session) -> dict:
    actions = []
    
    risks_data = detect_risks(db)
    risks = risks_data.get("risks", [])
    
    opportunities_data = detect_opportunities(db)
    opportunities = opportunities_data.get("opportunities", [])
    
    now_str = datetime.now().strftime("%Y-%m-%d")

    # Mapping Risks to Actions
    for risk in risks:
        if risk["title"] == "Negative Profit":
            actions.append({"priority": "high", "action": "Immediately review operational expenses and cut non-essentials."})
        elif risk["title"] == "High Expense Ratio":
            actions.append({"priority": "medium", "action": "Audit current software and contractor expenses."})
        elif risk["title"] == "Overdue Projects":
            # Let's get specific project names if possible, but for simplicity:
            overdue_projects = db.query(Project).filter(Project.status == "active", Project.deadline != None, Project.deadline < now_str).all()
            for p in overdue_projects:
                actions.append({"priority": "high", "action": f"Review overdue project: {p.name}."})
        elif risk["title"] == "Overdue Tasks":
            overdue_tasks = db.query(Task).filter(Task.status != "completed", Task.due_date != None, Task.due_date < now_str).count()
            actions.append({"priority": "medium", "action": f"Follow up on {overdue_tasks} overdue tasks."})
        elif risk["title"] == "Low Task Velocity":
            actions.append({"priority": "medium", "action": "Hold a team sync to unblock pending tasks."})
        elif risk["title"] == "Inactive Client Retention":
            actions.append({"priority": "low", "action": "Reach out to inactive clients for check-ins or upselling."})

    # Mapping Opportunities to Actions
    for opp in opportunities:
        if opp["title"] == "High Profitability":
            actions.append({"priority": "low", "action": "Consider increasing marketing budget to accelerate growth."})
        elif opp["title"] == "Revenue Momentum":
            actions.append({"priority": "medium", "action": "Double down on current successful revenue channels."})
        elif opp["title"] == "Underutilized Capacity":
            actions.append({"priority": "medium", "action": "Start new outbound sales campaign to fill pipeline."})
        elif opp["title"] == "Client Retention":
            actions.append({"priority": "low", "action": "Request referrals or testimonials from recently completed projects."})

    # Ensure high priority is at the top
    priority_order = {"high": 0, "medium": 1, "low": 2}
    actions.sort(key=lambda x: priority_order.get(x["priority"], 3))

    return {"actions": actions}
