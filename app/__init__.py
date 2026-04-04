import os
from flask import Flask


def create_app():
    """Application factory — creates and configures the Flask app."""

    app = Flask(
        __name__,
        template_folder="../templates",
        static_folder="../static"
    )

    # ------------------------------------------------------------------ #
    # Configuration                                                        #
    # ------------------------------------------------------------------ #
    app.secret_key = os.getenv("SECRET_KEY", "your-secret-key")
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

    # ------------------------------------------------------------------ #
    # Security headers (applied to every response)                        #
    # ------------------------------------------------------------------ #
    @app.after_request
    def set_security_headers(response):
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response

    # ------------------------------------------------------------------ #
    # Database initialisation                                             #
    # ------------------------------------------------------------------ #
    from app.db import init_db
    init_db()

    # ------------------------------------------------------------------ #
    # Blueprint registration                                              #
    # ------------------------------------------------------------------ #
    from app.auth import auth
    from app.routes import main

    app.register_blueprint(auth)
    app.register_blueprint(main)

    return app


# Create the app instance (used by root app.py and gunicorn's "app:app")
app = create_app()
