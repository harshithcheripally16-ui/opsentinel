from flask import Blueprint, jsonify, render_template, request, session, redirect, url_for, flash
from werkzeug.security import check_password_hash
from app.db import get_user, create_user

auth = Blueprint("auth", __name__)


# ------------------------------------------------------------------ #
# Shared helpers                                                       #
# ------------------------------------------------------------------ #

def _parse_form():
    """Return request data regardless of JSON or form submission."""
    data = request.get_json() if request.is_json else request.form
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    return username, password


def _validate_credentials(username, password, check_duplicate=False):
    """
    Validate username/password format.
    Optionally check for an existing user (used during signup).
    Returns an error string or None.
    """
    if not username or not password:
        return "Username and password are required."
    if len(username) < 3:
        return "Username must be at least 3 characters."
    if len(password) < 3:
        return "Password must be at least 3 characters."
    if check_duplicate and get_user(username):
        return "Username already taken. Please choose another."
    return None


def _fail(error, template):
    """Respond with error — JSON for API clients, flash + render for browsers."""
    if request.is_json:
        return jsonify({"status": "error", "message": error}), 400
    flash(error, "error")
    return render_template(template)


# ------------------------------------------------------------------ #
# Routes                                                               #
# ------------------------------------------------------------------ #

@auth.route("/signup", methods=["GET", "POST"])
def signup():
    if session.get("user"):
        print(f"[AUTH] User already authenticated: {session['user']}, redirecting to dashboard.")
        return redirect(url_for("main.dashboard"))

    if request.method == "POST":
        username, password = _parse_form()
        error = _validate_credentials(username, password, check_duplicate=True)
        if error:
            return _fail(error, "signup.html")

        create_user(username, password)
        flash(f"Account created! Welcome, {username}. Please sign in.", "success")
        return redirect(url_for("auth.login"))

    return render_template("signup.html")


@auth.route("/login", methods=["GET", "POST"])
def login():
    if session.get("user"):
        print(f"[AUTH] User already authenticated: {session['user']}, redirecting to dashboard.")
        return redirect(url_for("main.dashboard"))

    if request.method == "POST":
        username, password = _parse_form()
        error = _validate_credentials(username, password)
        if error:
            return _fail(error, "login.html")

        user = get_user(username)
        if user and check_password_hash(user["password"], password):
            print(f"[AUTH] Authentication successful for: {username}")
            session["user"] = username
            return redirect(url_for("main.dashboard"))

        return _fail("Invalid username or password.", "login.html")

    return render_template("login.html")


@auth.route("/logout")
def logout():
    username = session.get("user", "")
    session.clear()
    flash(f"You have been signed out{f', {username}' if username else ''}.", "success")
    return redirect(url_for("auth.login"))
