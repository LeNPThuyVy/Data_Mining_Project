import csv
import io
import json
import logging
from datetime import datetime
from flask import (
    Blueprint, request, jsonify, Response,
    render_template, redirect, url_for, session, flash
)
from app.ml_service import predict_anomaly

logger = logging.getLogger(__name__)
main = Blueprint("main", __name__)

#Các post mẫu
_session_history = []

MOCK_POSTS = [
    {
        "id": 1, "username": "travel_junkie",
        "avatar": "https://i.pravatar.cc/48?img=1",
        "content": "Hoàng hôn tại Mũi Né đẹp đến nao lòng 🌅 #travel #muine",
        "image": "https://picsum.photos/seed/muine/600/350",
        "likes": 342, "time": "2 giờ trước",
    },
    {
        "id": 2, "username": "foodie_saigon",
        "avatar": "https://i.pravatar.cc/48?img=5",
        "content": "Bánh mì xíu mại Sài Gòn buổi sáng — không đâu ngon bằng! 🥖",
        "image": "https://picsum.photos/seed/banhmi/600/350",
        "likes": 198, "time": "4 giờ trước",
    },
    {
        "id": 3, "username": "dev.diary",
        "avatar": "https://i.pravatar.cc/48?img=12",
        "content": "Sau 6 tháng học ML, cuối cùng mình cũng deploy được model đầu tiên lên production 🚀",
        "image": None, "likes": 512, "time": "6 giờ trước",
    },
    {
        "id": 4, "username": "nature_vn",
        "avatar": "https://i.pravatar.cc/48?img=20",
        "content": "Ruộng bậc thang Mù Cang Chải mùa lúa chín 🌾 #mucangchai",
        "image": "https://picsum.photos/seed/mucang/600/350",
        "likes": 876, "time": "1 ngày trước",
    },
    {
        "id": 5, "username": "book_worm99",
        "avatar": "https://i.pravatar.cc/48?img=33",
        "content": "Review: 'Đắc Nhân Tâm' — cuốn sách đã thay đổi cách mình giao tiếp hoàn toàn 📚",
        "image": None, "likes": 130, "time": "2 ngày trước",
    },
]


# ---------------------------------------------------------------------------
# Page routes
# ---------------------------------------------------------------------------

@main.route("/")
def index():
    return redirect(url_for("main.login"))


@main.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "").strip()
        if username and password:
            session["username"] = username
            return redirect(url_for("main.feed"))
        flash("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.", "error")
    return render_template("login.html")


@main.route("/feed")
def feed():
    if "username" not in session:
        return redirect(url_for("main.login"))
    return render_template("feed.html", posts=MOCK_POSTS, username=session["username"])


@main.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("main.login"))


# API: nhận telemetry, phân tích, lưu history
@main.route("/api/track_behavior", methods=["POST"])
def track_behavior():
    #Nhận JSON payload:session_duration, like_count, comment_count, post_count,ad_click, activity_intensity, algorithm ("kmeans"|"dbscan")
    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"error": "Payload JSON không hợp lệ"}), 400

    algorithm = payload.get("algorithm", "kmeans")

    logger.info("=" * 60)
    logger.info("[TELEMETRY] Dữ liệu nhận từ Frontend:")
    logger.info(json.dumps(payload, indent=2, ensure_ascii=False))
    logger.info("=" * 60)

    result = predict_anomaly(payload, algorithm=algorithm)
    logger.info(f"[ML RESULT] {result}")

    # Lưu vào history
    record = {
        **{k: v for k, v in payload.items() if k != "algorithm"},
        "algorithm": algorithm,
        "username": session.get("username", "anonymous"),
        "timestamp": datetime.now().strftime("%H:%M:%S"),
        "prediction": result,
    }
    _session_history.append(record)

    return jsonify({"status": "ok", "received": payload, "prediction": result})


@main.route("/api/sessions", methods=["GET"])
def get_sessions():
    #Trả về danh sách tối đa 50 session gần nhất.
    return jsonify({"sessions": _session_history[-50:], "total": len(_session_history)})


@main.route("/api/export/csv", methods=["GET"])
def export_csv():
    #Xuất toàn bộ session history ra file CSV để dùng trong notebook/phân tích.
    if not _session_history:
        return jsonify({"error": "Chưa có dữ liệu"}), 404

    fieldnames = [
        "timestamp", "username", "algorithm",
        "daily_active_minutes_instagram",
        "sessions_per_day",
        "posts_created_per_week",
        "reels_watched_per_day",
        "likes_given_per_day",
        "comments_written_per_day",
        "dms_sent_per_week",
        "dms_received_per_week",
        "ads_viewed_per_day",
        "ads_clicked_per_day",
        "time_on_feed_per_day",
        "time_on_explore_per_day",
        "time_on_messages_per_day",
        "time_on_reels_per_day",
        "followers_count",
        "following_count",
        "notification_response_rate",
        "average_session_length_minutes",
        "linked_accounts_count",
        "days_since_last_login",
        "interact_density",
        "interact_per_session",
        "dm_ratio",
        "activity_per_session",
        "activity_intensity",
        "predicted_label", "is_anomaly", "cluster_id", "confidence",
    ]

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()

    for record in _session_history:
        pred = record.get("prediction", {})
        row = {
            "timestamp":        record.get("timestamp", ""),
            "username":         record.get("username", ""),
            "algorithm":        record.get("algorithm", "kmeans"),
            "predicted_label":  pred.get("label", ""),
            "is_anomaly":       1 if pred.get("is_anomaly") else 0,
            "cluster_id":       pred.get("cluster_id", -1),
            "confidence":       pred.get("confidence", ""),
        }
        for col in [
            "daily_active_minutes_instagram", "sessions_per_day", "posts_created_per_week",
            "reels_watched_per_day", "likes_given_per_day", "comments_written_per_day",
            "dms_sent_per_week", "dms_received_per_week", "ads_viewed_per_day", "ads_clicked_per_day",
            "time_on_feed_per_day", "time_on_explore_per_day", "time_on_messages_per_day",
            "time_on_reels_per_day", "followers_count", "following_count", "notification_response_rate",
            "average_session_length_minutes", "linked_accounts_count", "days_since_last_login",
            "interact_density", "interact_per_session", "dm_ratio", "activity_per_session",
            "activity_intensity"
        ]:
            row[col] = record.get(col, 0)
            
        writer.writerow(row)

    csv_content = output.getvalue()
    return Response(
        csv_content,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=behavior_dataset.csv"},
    )


@main.route("/api/clear_sessions", methods=["POST"])
def clear_sessions():
    _session_history.clear()
    return jsonify({"status": "ok", "message": "Đã xóa toàn bộ lịch sử"})


# Admin: Hiển thị kết quả clustering

import os, base64
from pathlib import Path

CLUSTER_IMG_DIR = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "Clustering_Result", "AnhKetQuaClustering"
)

def _build_gallery():
    #Nhóm ảnh theo thuật toán
    gallery = {"kmeans": [], "dbscan": []}
    if not os.path.isdir(CLUSTER_IMG_DIR):
        return gallery
    for fname in sorted(os.listdir(CLUSTER_IMG_DIR)):
        if not fname.lower().endswith(".png"):
            continue
        entry = {"filename": fname}
        if fname.startswith("DBSCAN"):
            gallery["dbscan"].append(entry)
        else:
            gallery["kmeans"].append(entry)
    return gallery


@main.route("/admin")
def admin():
    gallery = _build_gallery()

    # Thống kê session
    total = len(_session_history)
    anomalies = sum(1 for s in _session_history if s.get("prediction", {}).get("is_anomaly"))
    normal = total - anomalies

    stats = {
        "total": total,
        "anomalies": anomalies,
        "normal": normal,
        "anomaly_pct": round(anomalies / total * 100, 1) if total else 0,
    }

    return render_template("admin.html", gallery=gallery, stats=stats, sessions=_session_history[-20:])
