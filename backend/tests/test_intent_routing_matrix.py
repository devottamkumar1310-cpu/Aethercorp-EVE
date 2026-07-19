from app.services.ai.conversation_layer import ConversationLayer
from app.orchestration.validator import ExecutiveGovernanceValidator

def test_intent_routing_matrix():
    """
    Objective 5: 20+ query verification suite covering all targeted business domains.
    Validates that query -> intent classification aligns perfectly with expectations.
    """
    matrix = {
        # Inventory Domain
        "What should I reorder?": "Inventory Query",
        "Which SKUs are out of stock?": "Inventory Query",
        "Do we have any overstock in the warehouse?": "Inventory Query",
        "What is our safety stock level for product lines?": "Inventory Query",
        "Identify our dead stock or aging inventory.": "Inventory Query",

        # Finance Domain
        "What is hurting our profitability?": "Sales Query", # profit/profitability keyword is mapped to Sales/Growth
        "How are our expenses trending this month?": "Finance Query",
        "Show me our budget allocation details.": "Finance Query",
        "What is our cash flow projection?": "Forecast Query",
        "Identify margin leaks in our cost categories.": "Pricing Query",

        # Sales Domain
        "How do we increase sales?": "Sales Query",
        "What are our biggest revenue opportunities?": "Sales Query",
        "Which market segments should we expand into?": "Sales Query",
        "What is the timeline for our growth opportunities?": "Sales Query",

        # Customers Domain
        "Which clients are at risk of churning?": "Customers Query",
        "Who should I contact for customer outreach this week?": "Customers Query",
        "Identify inactive clients in our workspace.": "Customers Query",
        "What is our customer retention rate?": "Customers Query",

        # Supply Chain Domain
        "What are the top bottlenecks in our supply chain?": "Supply Chain Query",
        "Evaluate our vendor lead times.": "Supply Chain Query",
        "Identify reliable suppliers based on delivery metrics.": "Supply Chain Query",
        "Are there logistics delays with our carrier?": "Supply Chain Query",

        # Projects Domain
        "Which projects are delayed?": "Projects Query",
        "Show me the project roadmap milestones.": "Projects Query",

        # Tasks Domain
        "How do we mitigate overdue tasks?": "PROJECT_MITIGATION",
        "List all blocked tasks in the backlog.": "Tasks Query",

        # Executive Summary Domain
        "Give me an executive summary.": "Executive Summary Query",
        "What is the overall health score of my business?": "Executive Summary Query",

        # Operations Domain
        "How is our team operations efficiency?": "Operations Query",
        "What should the team focus on this week?": "Operations Query",
    }

    assert len(matrix) >= 20, f"Test suite must contain at least 20 queries, got {len(matrix)}"

    for query, expected_intent in matrix.items():
        intent = ConversationLayer.classify_intent(query)
        assert intent == expected_intent, f"Query '{query}' classified as '{intent}', expected '{expected_intent}'."


def test_supply_chain_data_sufficiency():
    """
    Objective 4: Hallucination Reduction.
    Verify that when no suppliers/vendors exist in the overview, EVE flags
    supply chain queries as DATA_INSUFFICIENT with a custom message.
    """
    overview_no_suppliers = {
        "clients": 5,
        "projects": 2,
        "tasks": 10,
        "revenue": 10000.0,
        "inventory": 50,
        "suppliers": 0
    }
    
    question = "What are our supply chain bottlenecks?"
    status, msg, domains = ExecutiveGovernanceValidator.validate_data_sufficiency(overview_no_suppliers, question)
    
    assert status == "DATA_INSUFFICIENT"
    assert "supply chain bottlenecks" in msg
    assert "no supply chain metrics are currently available" in msg
    assert domains["supply_chain"] is False


def test_supply_chain_data_sufficiency_success():
    """
    Verify that when suppliers exist in the overview, EVE validates the data
    sufficiency successfully for supply chain queries.
    """
    overview_with_suppliers = {
        "clients": 5,
        "projects": 2,
        "tasks": 10,
        "revenue": 10000.0,
        "inventory": 50,
        "suppliers": 3
    }
    
    question = "What are our supply chain bottlenecks?"
    status, msg, domains = ExecutiveGovernanceValidator.validate_data_sufficiency(overview_with_suppliers, question)
    
    assert status in ["FULL_DATA", "PARTIAL_DATA"]
    assert domains["supply_chain"] is True
