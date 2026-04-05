from flask import Blueprint, jsonify, render_template, request, session, redirect, url_for
import psutil
import platform
import socket
import platform
import socket

from app.utils import (
    get_high_usage_issues,
    should_send_alert,
    send_telegram_alert,
    ok_response,
    login_required,
)

main = Blueprint("main", __name__)


@main.route("/")
def index():
    return redirect(url_for("main.dashboard"))


@main.route("/dashboard")
@login_required
def dashboard():
    return render_template("index.html")


@main.route("/metrics")
def metrics():
    print("[METRICS] Fetching latest telemetry batch...")
    try:
        cpu    = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory().percent
        disk   = psutil.disk_usage("/").percent

        issues = get_high_usage_issues(cpu, memory, disk)
        if issues and should_send_alert():
            send_telegram_alert(f"🚨 High resource usage detected: {', '.join(issues)}")

        print(f"[METRICS] Returned successfully. CPU: {cpu}%, MEM: {memory}%, DSK: {disk}%")
        return jsonify(ok_response({"cpu": cpu, "memory": memory, "disk": disk}))
    except Exception as e:
        print(f"[METRICS ERROR] Exception during telemetry fetch: {e}")
        # Failsafe: Return zeroed metrics to prevent dashboard crash
        return jsonify(ok_response({"cpu": 0, "memory": 0, "disk": 0}))


@main.route("/api/system-info")
def system_info():
    info = {
        "os": f"{platform.system()} {platform.release()}",
        "hostname": socket.gethostname(),
        "cores": psutil.cpu_count(logical=True)
    }
    return jsonify(ok_response(info))


@main.route("/alert", methods=["POST"])
def alert():
    data    = request.get_json() or {}
    message = data.get("message", "")
    if message:
        print(f"Alert received: {message}")
    return jsonify({"status": "received"})
