from flask import Blueprint, jsonify, render_template, request, session, redirect, url_for
import psutil

from app.utils import (
    get_high_usage_issues,
    should_send_alert,
    send_telegram_alert,
    ok_response,
    login_required,
)

main = Blueprint("main", __name__)


@main.route("/")
@login_required
def home():
    return render_template("index.html")


@main.route("/metrics")
def metrics():
    cpu    = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory().percent
    disk   = psutil.disk_usage("/").percent

    issues = get_high_usage_issues(cpu, memory, disk)
    if issues and should_send_alert():
        send_telegram_alert(f"🚨 High resource usage detected: {', '.join(issues)}")

    return jsonify(ok_response({"cpu": cpu, "memory": memory, "disk": disk}))


@main.route("/alert", methods=["POST"])
def alert():
    data    = request.get_json() or {}
    message = data.get("message", "")
    if message:
        print(f"Alert received: {message}")
    return jsonify({"status": "received"})
