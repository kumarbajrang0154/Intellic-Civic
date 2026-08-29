import os
from dotenv import load_dotenv

# Load environment variables from monorepo root .env file
root_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.env"))
if os.path.exists(root_env):
    load_dotenv(root_env)
else:
    load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
PORT = int(os.getenv("PORT", "8000"))
HOST = os.getenv("HOST", "0.0.0.0")

# Threshold constants for Recommendation Engine (Evidence Verification)
AUTO_APPROVE_CONFIDENCE_THRESHOLD = 0.85
AUTO_FLAG_CONFIDENCE_THRESHOLD = 0.40

# Threshold constants for Complaint Routing Engine
AUTO_ROUTE_CONFIDENCE_THRESHOLD = 0.75
SUGGEST_ONLY_CONFIDENCE_THRESHOLD = 0.40

def check_gemini_api_key():
    """Verify that GEMINI_API_KEY is configured on startup."""
    if not GEMINI_API_KEY:
        raise RuntimeError(
            "CRITICAL: GEMINI_API_KEY environment variable is not set. "
            "Please set GEMINI_API_KEY in the root .env file."
        )
