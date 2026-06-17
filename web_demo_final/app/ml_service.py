

import os
import logging
import warnings
import numpy as np
import joblib

warnings.filterwarnings("ignore")
logger = logging.getLogger(__name__)

#Đường dẫn file

BASE_DIR  = os.path.dirname(os.path.dirname(__file__))  # web_demo_final/
MODEL_DIR = os.path.join(BASE_DIR, "Data_Mining_Project", "Clustering_Result", "Model")

SCALER_PATH      = os.path.join(BASE_DIR, "scaler.pkl")
PCA_PATH         = os.path.join(BASE_DIR, "pca.pkl")
KMEANS_PATH      = os.path.join(MODEL_DIR, "kmeans_model.pkl")
DBSCAN_X_15_PATH = os.path.join(MODEL_DIR, "DBSCAN_1.5EpsValue_X_features.pkl")
DBSCAN_L_15_PATH = os.path.join(MODEL_DIR, "DBSCAN_1.5EpsValue_labels.pkl")
DBSCAN_X_17_PATH = os.path.join(MODEL_DIR, "DBSCAN_1.7EpsValue_X_features.pkl")
DBSCAN_L_17_PATH = os.path.join(MODEL_DIR, "DBSCAN_1.7EpsValue_labels.pkl")

#Danh sách 25 features
FEATURE_COLS = [
    "daily_active_minutes_instagram", "sessions_per_day", "posts_created_per_week",
    "reels_watched_per_day", "likes_given_per_day", "comments_written_per_day",
    "dms_sent_per_week", "dms_received_per_week", "ads_viewed_per_day",
    "ads_clicked_per_day", "time_on_feed_per_day", "time_on_explore_per_day",
    "time_on_messages_per_day", "time_on_reels_per_day", "followers_count",
    "following_count", "notification_response_rate", "average_session_length_minutes",
    "linked_accounts_count", "days_since_last_login", "interact_density",
    "interact_per_session", "dm_ratio", "activity_per_session", "activity_intensity",
]

#Nhãn hiển thị
KMEANS_LABEL_MAP = {
    0: "Bình thường (Nhóm A – Tích cực)",
    1: "Bất thường (Tương tác bất thường)",
    2: "Bình thường (Nhóm B – Trung bình)",
}
# Cluster 1 là bất thường: activity thấp nhưng interact_density cao bất thường
KMEANS_ANOMALY_CLUSTER = 1

# Bán kính điển hình (p95 centroid distance) của mỗi cluster từ training data.
# Điểm có centroid_distance > OUTLIER_FACTOR * radius → cực đoan, cảnh báo thêm.
KMEANS_CLUSTER_RADIUS = {
    0: 8.5,    # cluster 0 (active)  – p95 khoảng cách tới centroid
    1: 6.0,    # cluster 1 (anomaly) – p95 khoảng cách tới centroid
    2: 6.5,    # cluster 2 (average) – p95 khoảng cách tới centroid
}
KMEANS_OUTLIER_FACTOR = 4.0   # > 4x radius → cực đoan

DBSCAN_LABEL_MAP = {
    0:  "Bình thường",
    -1: "Bất thường – Noise (DBSCAN)",
}

#Ngưỡng cảnh báo feature (dùng để tạo danh sách suspicious_features)
FEATURE_THRESHOLDS = {
    "daily_active_minutes_instagram": {"warn": 180,  "danger": 360},
    "sessions_per_day":               {"warn": 15,   "danger": 40},
    "posts_created_per_week":         {"warn": 10,   "danger": 30},
    "reels_watched_per_day":          {"warn": 100,  "danger": 300},
    "likes_given_per_day":            {"warn": 100,  "danger": 400},
    "comments_written_per_day":       {"warn": 30,   "danger": 100},
    "dms_sent_per_week":              {"warn": 150,  "danger": 500},
    "ads_clicked_per_day":            {"warn": 10,   "danger": 30},
    "days_since_last_login":          {"warn": 30,   "danger": 90},
    "activity_intensity":             {"warn": 5.0,  "danger": 15.0},
    "interact_density":               {"warn": 2.5,  "danger": 8.0},
}

#Cache model
_cache: dict = {}


def _get_scaler():
    #Load StandardScaler từ scaler.pkl
    if "scaler" not in _cache:
        logger.info("[ML] Loading scaler.pkl …")
        _cache["scaler"] = joblib.load(SCALER_PATH)
        logger.info("[ML] scaler.pkl loaded: %s (mean_ shape=%s)",
                    _cache["scaler"].__class__.__name__,
                    _cache["scaler"].mean_.shape)
    return _cache["scaler"]


def _get_pca():
    #Load PCA transformer từ pca.pkl
    if "pca" not in _cache:
        logger.info("[ML] Loading pca.pkl …")
        _cache["pca"] = joblib.load(PCA_PATH)
        logger.info("[ML] pca.pkl loaded: %s (components_=%s)",
                    _cache["pca"].__class__.__name__,
                    _cache["pca"].components_.shape)
    return _cache["pca"]


def _get_kmeans():
    #Load KMeans model từ kmeans_model.pkl (lazy, cached).
    if "kmeans" not in _cache:
        logger.info("[ML] Loading kmeans_model.pkl …")
        _cache["kmeans"] = joblib.load(KMEANS_PATH)
        logger.info("[ML] KMeans loaded: n_clusters=%d, centers_shape=%s",
                    _cache["kmeans"].n_clusters,
                    _cache["kmeans"].cluster_centers_.shape)
    return _cache["kmeans"]


def _get_dbscan(eps_key: str = "1.5"):
    #Load DBSCAN training data và BallTree
    cache_key = f"dbscan_{eps_key}"
    if cache_key not in _cache:
        logger.info("[ML] Loading DBSCAN eps=%s …", eps_key)
        if eps_key == "1.7":
            X = joblib.load(DBSCAN_X_17_PATH)
            L = joblib.load(DBSCAN_L_17_PATH)
        else:
            X = joblib.load(DBSCAN_X_15_PATH)
            L = joblib.load(DBSCAN_L_15_PATH)

        # Chỉ giữ core points (label != -1) để tìm lân cận
        core_mask = L != -1
        X_core = X[core_mask]
        L_core = L[core_mask]

        # Sample tối đa 50K điểm để BallTree không quá nặng RAM
        from sklearn.neighbors import BallTree
        n_sample = min(50_000, len(X_core))
        idx = np.random.default_rng(0).choice(len(X_core), n_sample, replace=False)
        bt  = BallTree(X_core[idx], leaf_size=40)

        _cache[cache_key] = {
            "X_core":      X_core[idx],
            "L_core":      L_core[idx],
            "tree":        bt,
            "noise_ratio": float((L == -1).mean()),
            "eps":         float(eps_key),
        }
        logger.info("[ML] DBSCAN eps=%s: core=%d, noise=%.1f%%",
                    eps_key, core_mask.sum(), (L == -1).mean() * 100)
    return _cache[cache_key]


#Inference Pipeline 

def _extract_features(data: dict) -> dict:
    #Trích xuất và ép kiểu float cho 25 features từ payload.
    return {k: float(data.get(k, 0.0)) for k in FEATURE_COLS}


def _normalize_units(d: dict) -> dict:
    """
    Chuẩn hóa đơn vị cho các feature có thể bị gửi sai scale từ frontend.

    Training data dùng:
      - notification_response_rate : tỷ lệ [0.0, 1.0]
      - dm_ratio                   : tỷ lệ [0.0, 1.0]

    Nếu frontend gửi theo dạng phần trăm [0, 100] thì tự động chia 100.
    Các feature khác giữ nguyên.
    """
    out = dict(d)  

    # Nếu giá trị > 1.0 tức là đang ở dạng % thì chuyển về [0,1]
    notif = out.get("notification_response_rate", 0.0)
    if notif > 1.0:
        out["notification_response_rate"] = notif / 100.0
        logger.debug("[ML] notification_response_rate: %.1f%% -> %.4f (tu dong chia 100)",
                     notif, out["notification_response_rate"])

    # dm_ratio: phai co gia tri trong [0, 1], neu > 1 thi cap lai
    dm = out.get("dm_ratio", 0.0)
    if dm > 1.0:
        out["dm_ratio"] = min(dm / 100.0, 1.0)
        logger.debug("[ML] dm_ratio: %.4f -> %.4f (chuan hoa ve [0,1])", dm, out["dm_ratio"])

    return out


def _to_vector25(d: dict) -> np.ndarray:
    #Chuyển dict features thành numpy array shape (1, 25).
    return np.array([[d[k] for k in FEATURE_COLS]], dtype=np.float64)


def _run_pipeline(d: dict) -> np.ndarray:
    d_norm = _normalize_units(d) # chuẩn hóa
    vec25  = _to_vector25(d_norm) # chuyển đữ liệu thành vector 25 chiều 
    scaled = _get_scaler().transform(vec25) # chuẩn hóa trước pca
    pca9   = _get_pca().transform(scaled) # pca

    logger.debug("[ML] Pipeline: raw[notif=%.3f] -> scaled[notif=%.3f] -> pca9[:4]=%s",
                 d_norm.get('notification_response_rate', 0),
                 scaled[0, FEATURE_COLS.index('notification_response_rate')],
                 pca9[0, :4].round(3))
    return pca9

#Phân tích ngưỡng để trả về cảnh báo
def _analyze_suspicious(d: dict) -> list:
    flags = []
    for key, th in FEATURE_THRESHOLDS.items():
        val = d.get(key, 0.0)
        if val >= th.get("danger", 1e18):
            flags.append(f"{key}={val:.2f} (vượt ngưỡng nguy hiểm)")
        elif val >= th.get("warn", 1e18):
            flags.append(f"{key}={val:.2f} (đáng ngờ)")
    return flags


# Predictors 
def _predict_kmeans(d: dict, suspicious: list) -> dict:
    pca9 = _run_pipeline(d)                    
    km   = _get_kmeans()
    cluster_id = int(km.predict(pca9)[0])

    # Khoảng cách tới centroid được gán
    center = km.cluster_centers_[cluster_id]     
    dist   = float(np.linalg.norm(pca9[0] - center))

    # Khoảng cách tới tất cả centroid
    all_dists = [float(np.linalg.norm(pca9[0] - km.cluster_centers_[c]))
                 for c in range(km.n_clusters)]
    avg_dist = float(np.mean(all_dists))

    # Phát hiện extreme outlier: xa hơn OUTLIER_FACTOR lần bán kính điển hình
    cluster_radius  = KMEANS_CLUSTER_RADIUS.get(cluster_id, 7.0)
    is_extreme      = dist > KMEANS_OUTLIER_FACTOR * cluster_radius
    is_anomaly      = (cluster_id == KMEANS_ANOMALY_CLUSTER) or is_extreme

    # Confidence: gần centroid → cao, xa → thấp
    relative_dist = dist / (avg_dist + 1e-9)
    if is_extreme:
        # Extreme outlier: confidence thấp hơn
        confidence = round(float(np.clip(0.55 + len(suspicious) * 0.03, 0.55, 0.85)), 2)
        label = "Bất thường (Extreme Outlier)" if not (cluster_id == KMEANS_ANOMALY_CLUSTER) \
                else KMEANS_LABEL_MAP[cluster_id]
    else:
        confidence = round(float(np.clip(1.0 - relative_dist * 0.35, 0.50, 0.97)), 2)
        label = KMEANS_LABEL_MAP.get(cluster_id, f"Cụm {cluster_id}")

    logger.info("[KMeans] cluster=%d dist=%.3f radius=%.1f extreme=%s",
                cluster_id, dist, cluster_radius, is_extreme)

    return {
        "label":               label,
        "is_anomaly":          is_anomaly,
        "confidence":          confidence,
        "cluster_id":          cluster_id,
        "algorithm":           "K-Means",
        "suspicious_features": suspicious,
        "centroid_distance":   round(dist, 4),
        "is_extreme_outlier":  is_extreme,
    }


def _predict_dbscan(d: dict, suspicious: list, eps_key: str = "1.5") -> dict:
    pca9 = _run_pipeline(d)                          # (1, 9)
    db   = _get_dbscan(eps_key)

    dist, idx  = db["tree"].query(pca9, k=1)
    nn_dist    = float(dist[0, 0])
    nn_label   = int(db["L_core"][idx[0, 0]])

    # Dùng đúng eps của model DBSCAN để phân loại
    eps_val    = db["eps"]
    cluster_id = -1 if nn_dist > eps_val else nn_label

    # Confidence: càng gần core point → càng tự tin
    if cluster_id == -1:
        # Noise: tự tin tỷ lệ với khoảng cách vượt eps
        conf = round(float(np.clip(0.55 + (nn_dist - eps_val) / (eps_val * 10), 0.55, 0.95)), 2)
    else:
        conf = round(float(np.clip(1.0 - nn_dist / (eps_val * 2), 0.55, 0.95)), 2)

    is_anomaly = (cluster_id == -1)

    return {
        "label":               DBSCAN_LABEL_MAP.get(cluster_id, f"Cụm {cluster_id}"),
        "is_anomaly":          is_anomaly,
        "confidence":          conf,
        "cluster_id":          cluster_id,
        "algorithm":           f"DBSCAN (eps={eps_key})",
        "suspicious_features": suspicious,
        "nn_distance":         round(nn_dist, 4),
        "eps_threshold":       eps_val,
    }


#Hàm dự đoán được gọi từ routes.py

def predict_anomaly(data: dict, algorithm: str = "kmeans") -> dict:
    d          = _extract_features(data)
    suspicious = _analyze_suspicious(d)

    try:
        if algorithm == "dbscan_17":
            return _predict_dbscan(d, suspicious, eps_key="1.7")
        elif algorithm == "dbscan":
            return _predict_dbscan(d, suspicious, eps_key="1.5")
        else:
            return _predict_kmeans(d, suspicious)

    except Exception as exc:
        logger.exception("[ML] Prediction error (algorithm=%s): %s", algorithm, exc)
        # Fallback dựa trên suspicious features khi model lỗi
        is_sus = len(suspicious) > 0
        return {
            "label":               "Bất thường (fallback)" if is_sus else "Bình thường (fallback)",
            "is_anomaly":          is_sus,
            "confidence":          0.60,
            "cluster_id":          -1 if is_sus else 0,
            "algorithm":           f"{algorithm.upper()} [FALLBACK – lỗi pipeline]",
            "suspicious_features": suspicious,
            "error":               str(exc),
        }
