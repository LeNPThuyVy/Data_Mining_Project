# Các thay đổi so với bản gốc

## 1. `app/ml_service.py` — Tích hợp model thật

### KMeans (`/api/track_behavior?algorithm=kmeans`)
- Load `Clustering_Result/Model/kmeans_model.pkl` bằng `joblib`
- Predict cluster cho user mới bằng **score-based mapping**:
  - Tính `anomaly_score` từ 12 feature chuẩn hoá (0→1)
  - Cluster 1 (anomaly, 35K/500K): score ≥ 0.35 **hoặc** ≥ 3 suspicious features
  - Cluster 0 (Nhóm A – active): activity_intensity cao, followers nhiều
  - Cluster 2 (Nhóm B – trung bình): mặc định
- *Lý do dùng score-based:* không có `scaler.pkl`/`pca.pkl` gốc nên không thể project 25 raw features → PCA-9 space chính xác.

### DBSCAN (`algorithm=dbscan` / `algorithm=dbscan_17`)
- Load `DBSCAN_1.5EpsValue_X_features.pkl` + `_labels.pkl` bằng joblib
- Dùng **BallTree nearest-neighbor** trên 50K core points (subsample)
- Map raw features → PCA-9 bằng StandardScaler+PCA fit trên synthetic data
- Calibrated eps = **1.77** (eps=1.5) / **2.00** (eps=1.7) trong synthetic PCA space
- Nếu `nn_distance > cal_eps` → noise (-1) → anomaly

## 2. `app/routes.py` — Thêm Admin route

- `GET /admin` — Dashboard admin với gallery ảnh + session history
- Thêm option **DBSCAN eps=1.7** (`algorithm=dbscan_17`) trong feed UI

## 3. `app/templates/admin.html` — Trang Admin mới

- Thống kê live: tổng session, bình thường, bất thường, tỷ lệ anomaly
- Bảng 20 session gần nhất với cluster_id, confidence, label
- Gallery ảnh kết quả clustering (tab K-Means / DBSCAN theo eps)
- Lightbox xem ảnh toàn màn hình
- Nút xuất CSV (`/api/export/csv`)

## 4. `app/static/clustering_images/` — Ảnh kết quả clustering (17 file)

Copy từ `Clustering_Result/AnhKetQuaClustering/` để serve qua static URL.

## 5. `app/templates/feed.html` — Cập nhật UI

- Thêm option DBSCAN eps=1.7
- Link "Xem kết quả phân cụm (Admin Dashboard) →"
