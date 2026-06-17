"""
test_pipeline.py — Kiểm tra inference pipeline thật (scaler → pca → model)
"""
import sys, warnings, importlib.util, os
warnings.filterwarnings("ignore")

# Load ml_service trực tiếp (không qua Flask app)
spec = importlib.util.spec_from_file_location(
    "ml_service",
    os.path.join(os.path.dirname(__file__), "app", "ml_service.py")
)
ml = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ml)
predict_anomaly = ml.predict_anomaly

# ─── Dữ liệu test ───────────────────────────────────────────────────────────

normal_user = {
    "daily_active_minutes_instagram": 45,
    "sessions_per_day": 4,
    "posts_created_per_week": 2,
    "reels_watched_per_day": 20,
    "likes_given_per_day": 15,
    "comments_written_per_day": 5,
    "dms_sent_per_week": 30,
    "dms_received_per_week": 25,
    "ads_viewed_per_day": 5,
    "ads_clicked_per_day": 1,
    "time_on_feed_per_day": 20,
    "time_on_explore_per_day": 10,
    "time_on_messages_per_day": 10,
    "time_on_reels_per_day": 15,
    "followers_count": 350,
    "following_count": 400,
    "notification_response_rate": 0.6,    # frontend gửi dạng % → _normalize_units tự /100
    "average_session_length_minutes": 12,
    "linked_accounts_count": 1,
    "days_since_last_login": 0,
    "interact_density": 0.5,
    "interact_per_session": 5,
    "dm_ratio": 0.3,
    "activity_per_session": 5,
    "activity_intensity": 0.6,
}

bot_user = {
    "daily_active_minutes_instagram": 600,
    "sessions_per_day": 80,
    "posts_created_per_week": 50,
    "reels_watched_per_day": 400,
    "likes_given_per_day": 800,
    "comments_written_per_day": 250,
    "dms_sent_per_week": 900,
    "dms_received_per_week": 10,
    "ads_viewed_per_day": 50,
    "ads_clicked_per_day": 45,
    "time_on_feed_per_day": 120,
    "time_on_explore_per_day": 80,
    "time_on_messages_per_day": 200,
    "time_on_reels_per_day": 100,
    "followers_count": 50,
    "following_count": 9000,
    "notification_response_rate": 99,    # frontend gửi dạng % → _normalize_units tự /100
    "average_session_length_minutes": 8,
    "linked_accounts_count": 10,
    "days_since_last_login": 0,
    "interact_density": 12.0,
    "interact_per_session": 20,
    "dm_ratio": 0.98,
    "activity_per_session": 30,
    "activity_intensity": 25.0,
}

# User trung binh (gan voi training mean)
average_user = {
    "daily_active_minutes_instagram": 188,
    "sessions_per_day": 10,
    "posts_created_per_week": 6,
    "reels_watched_per_day": 175,
    "likes_given_per_day": 119,
    "comments_written_per_day": 34,
    "dms_sent_per_week": 29,
    "dms_received_per_week": 31,
    "ads_viewed_per_day": 20,
    "ads_clicked_per_day": 5,
    "time_on_feed_per_day": 94,
    "time_on_explore_per_day": 38,
    "time_on_messages_per_day": 33,
    "time_on_reels_per_day": 57,
    "followers_count": 2155,
    "following_count": 2600,
    "notification_response_rate": 0.5,   # gửi dạng tỷ lệ trực tiếp cũng hợp lệ
    "average_session_length_minutes": 20,
    "linked_accounts_count": 2,
    "days_since_last_login": 346,
    "interact_density": 1.25,
    "interact_per_session": 20,
    "dm_ratio": 0.5,
    "activity_per_session": 20,
    "activity_intensity": 3.1,
}

# ─── Chạy tests ──────────────────────────────────────────────────────────────

def run(label, data, algo):
    print(f"\n{'='*55}")
    print(f"  {label}")
    print(f"{'='*55}")
    r = predict_anomaly(data, algo)
    for k, v in r.items():
        if isinstance(v, list):
            print(f"  {k}: {v[:2]}{'...' if len(v) > 2 else ''}")
        else:
            print(f"  {k}: {v}")

run("TEST 1 — KMeans — User BINH THUONG",  normal_user,  "kmeans")
run("TEST 2 — KMeans — User TRUNG BINH",   average_user, "kmeans")
run("TEST 3 — KMeans — Bot / SPAMMER",     bot_user,     "kmeans")
run("TEST 4 — DBSCAN eps=1.5 — BINH THUONG",  normal_user,  "dbscan")
run("TEST 5 — DBSCAN eps=1.5 — TRUNG BINH",   average_user, "dbscan")
run("TEST 6 — DBSCAN eps=1.5 — Bot / SPAMMER", bot_user,    "dbscan")
run("TEST 7 — DBSCAN eps=1.7 — Bot / SPAMMER", bot_user,    "dbscan_17")

print("\n\n==> Tat ca tests da chay xong.")

