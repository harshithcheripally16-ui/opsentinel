import os
from app import app

if __name__ == "__main__":
    DEBUG = os.getenv("DEBUG", "False").lower() == "true"
    app.run(host="0.0.0.0", port=5000, debug=DEBUG)
