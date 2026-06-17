/**
 * tracking.js — Behavioral Telemetry Engine v3
 * =============================================
 * Quản lý state cho 25 chỉ số hành vi mạng xã hội.
 * Hỗ trợ hai chiều: tự động cập nhật khi tương tác và cho phép tinh chỉnh thủ công qua sliders.
 */

(function () {
    "use strict";

    // =========================================================
    // 1. KHỞI TẠO STATE HÀNH VI (25 FEATURES)
    // =========================================================
    const state = {
        // Time Spent (Minutes)
        daily_active_minutes_instagram: 0,
        time_on_feed_per_day: 0,
        time_on_explore_per_day: 0,
        time_on_reels_per_day: 0,
        time_on_messages_per_day: 0,
        sessions_per_day: 5,
        average_session_length_minutes: 0,

        // Interactions (Counts)
        likes_given_per_day: 0,
        comments_written_per_day: 0,
        reels_watched_per_day: 0,
        posts_created_per_week: 0,
        dms_sent_per_week: 0,
        dms_received_per_week: 0,
        ads_viewed_per_day: 0,
        ads_clicked_per_day: 0,
        notification_response_rate: 50, // %

        // Account Profile (Demographics)
        followers_count: 500,
        following_count: 300,
        linked_accounts_count: 1,
        days_since_last_login: 1,

        // Derived Metrics (Calculated)
        interact_density: 0,
        interact_per_session: 0,
        dm_ratio: 0,
        activity_per_session: 0,
        activity_intensity: 0
    };

    let activeTabId = "tab-feed";
    let isPresetMode = false;

    // Ngưỡng báo động để tô màu text (HUD & Breakdown)
    const THRESHOLDS = {
        daily_active_minutes_instagram:  { warn: 120, danger: 240 },
        sessions_per_day:                { warn: 15,  danger: 30 },
        posts_created_per_week:          { warn: 10,  danger: 25 },
        reels_watched_per_day:           { warn: 100, danger: 250 },
        likes_given_per_day:             { warn: 150, danger: 400 },
        comments_written_per_day:        { warn: 40,  danger: 100 },
        dms_sent_per_week:               { warn: 200, danger: 500 },
        dms_received_per_week:           { warn: 200, danger: 500 },
        ads_viewed_per_day:              { warn: 60,  danger: 150 },
        ads_clicked_per_day:             { warn: 8,   danger: 20 },
        followers_count:                 { warn: 50000, danger: 100000 },
        linked_accounts_count:           { warn: 4,   danger: 6 },
        days_since_last_login:           { warn: 15,  danger: 45 },
        interact_density:                { warn: 2.0, danger: 5.0 },
        activity_intensity:              { warn: 3.5, danger: 8.0 }
    };

    // Chuẩn hóa cho Radar Chart (8 chiều cốt lõi)
    const RADAR_MAX = {
        daily_active_minutes_instagram: 300,
        sessions_per_day: 40,
        likes_given_per_day: 500,
        reels_watched_per_day: 250,
        ads_clicked_per_day: 20,
        followers_count: 10000,
        interact_density: 6.0,
        activity_intensity: 10.0
    };

    // Hồ sơ tham chiếu của người dùng bình thường cho Radar Chart (8 chiều)
    // [ActiveMins, Sessions, Likes, Reels, AdClicks, Followers, InteractDensity, ActivityIntensity]
    const NORMAL_REF_PROFILE = [0.15, 0.12, 0.08, 0.10, 0.05, 0.05, 0.15, 0.10];

    // Presets cấu hình đầy đủ 25 cột
    const PRESETS = {
        normal: {
            time_on_feed_per_day: 15,
            time_on_explore_per_day: 10,
            time_on_reels_per_day: 12,
            time_on_messages_per_day: 8,
            sessions_per_day: 5,
            likes_given_per_day: 12,
            comments_written_per_day: 2,
            reels_watched_per_day: 15,
            posts_created_per_week: 1,
            dms_sent_per_week: 25,
            dms_received_per_week: 35,
            ads_viewed_per_day: 10,
            ads_clicked_per_day: 0,
            notification_response_rate: 70,
            followers_count: 420,
            following_count: 310,
            linked_accounts_count: 1,
            days_since_last_login: 1
        },
        spammer: {
            time_on_feed_per_day: 110,
            time_on_explore_per_day: 20,
            time_on_reels_per_day: 15,
            time_on_messages_per_day: 15,
            sessions_per_day: 15,
            likes_given_per_day: 480,
            comments_written_per_day: 180,
            reels_watched_per_day: 5,
            posts_created_per_week: 18,
            dms_sent_per_week: 350,
            dms_received_per_week: 25,
            ads_viewed_per_day: 25,
            ads_clicked_per_day: 1,
            notification_response_rate: 10,
            followers_count: 5600,
            following_count: 8200,
            linked_accounts_count: 3,
            days_since_last_login: 1
        },
        bot: {
            time_on_feed_per_day: 220,
            time_on_explore_per_day: 80,
            time_on_reels_per_day: 100,
            time_on_messages_per_day: 80,
            sessions_per_day: 45,
            likes_given_per_day: 950,
            comments_written_per_day: 480,
            reels_watched_per_day: 0,
            posts_created_per_week: 35,
            dms_sent_per_week: 850,
            dms_received_per_week: 40,
            ads_viewed_per_day: 140,
            ads_clicked_per_day: 8,
            notification_response_rate: 2,
            followers_count: 18000,
            following_count: 9500,
            linked_accounts_count: 5,
            days_since_last_login: 0
        },
        adclicker: {
            time_on_feed_per_day: 35,
            time_on_explore_per_day: 5,
            time_on_reels_per_day: 0,
            time_on_messages_per_day: 5,
            sessions_per_day: 8,
            likes_given_per_day: 4,
            comments_written_per_day: 1,
            reels_watched_per_day: 0,
            posts_created_per_week: 0,
            dms_sent_per_week: 0,
            dms_received_per_week: 0,
            ads_viewed_per_day: 70,
            ads_clicked_per_day: 38,
            notification_response_rate: 85,
            followers_count: 65,
            following_count: 40,
            linked_accounts_count: 1,
            days_since_last_login: 1
        }
    };

    // =========================================================
    // 2. TÍNH TOÁN CÁC CHỈ SỐ PHÁI SINH & ĐỒNG BỘ UI
    // =========================================================
    function recalculateDerived() {
        // 1. daily_active_minutes_instagram = Feed + Explore + Reels + Messages
        state.daily_active_minutes_instagram = 
            state.time_on_feed_per_day + 
            state.time_on_explore_per_day + 
            state.time_on_reels_per_day + 
            state.time_on_messages_per_day;

        // 2. average_session_length_minutes = active_minutes / sessions_per_day
        state.average_session_length_minutes = state.sessions_per_day > 0 
            ? parseFloat((state.daily_active_minutes_instagram / state.sessions_per_day).toFixed(2))
            : 0;

        // 3. interact_density = (Likes + Comments) / active_minutes
        state.interact_density = state.daily_active_minutes_instagram > 0
            ? parseFloat(((state.likes_given_per_day + state.comments_written_per_day) / state.daily_active_minutes_instagram).toFixed(3))
            : 0;

        // 4. interact_per_session = (Likes + Comments) / sessions_per_day
        state.interact_per_session = state.sessions_per_day > 0
            ? parseFloat(((state.likes_given_per_day + state.comments_written_per_day) / state.sessions_per_day).toFixed(3))
            : 0;

        // 5. dm_ratio = Sent / (Sent + Recv)
        const totalDMs = state.dms_sent_per_week + state.dms_received_per_week;
        state.dm_ratio = totalDMs > 0
            ? parseFloat((state.dms_sent_per_week / totalDMs).toFixed(3))
            : 0;

        // 6. Tổng hoạt động ước lượng hàng ngày
        // Lấy hoạt động ngày + chia hoạt động tuần ra ngày
        const dailyPosts = state.posts_created_per_week / 7;
        const dailyDMs = state.dms_sent_per_week / 7;
        const totalDailyActions = 
            state.likes_given_per_day + 
            state.comments_written_per_day + 
            state.reels_watched_per_day + 
            state.ads_clicked_per_day + 
            dailyPosts + 
            dailyDMs;

        // 7. activity_per_session = totalDailyActions / sessions_per_day
        state.activity_per_session = state.sessions_per_day > 0
            ? parseFloat((totalDailyActions / state.sessions_per_day).toFixed(3))
            : 0;

        // 8. activity_intensity = totalDailyActions / active_minutes
        state.activity_intensity = state.daily_active_minutes_instagram > 0
            ? parseFloat((totalDailyActions / state.daily_active_minutes_instagram).toFixed(3))
            : 0;
    }

    function syncStateToUI() {
        // Đồng bộ các nhãn hiển thị bên cạnh sliders
        const sliderMap = {
            "time-on-feed":      [state.time_on_feed_per_day, " m"],
            "time-on-explore":   [state.time_on_explore_per_day, " m"],
            "time-on-reels":     [state.time_on_reels_per_day, " m"],
            "time-on-messages":  [state.time_on_messages_per_day, " m"],
            "sessions-per-day":  [state.sessions_per_day, ""],
            "likes-given":       [state.likes_given_per_day, ""],
            "comments-written":  [state.comments_written_per_day, ""],
            "reels-watched":     [state.reels_watched_per_day, ""],
            "posts-created":     [state.posts_created_per_week, ""],
            "dms-sent":          [state.dms_sent_per_week, ""],
            "dms-received":      [state.dms_received_per_week, ""],
            "ads-viewed":        [state.ads_viewed_per_day, ""],
            "ads-clicked":       [state.ads_clicked_per_day, ""],
            "notif-rate":        [state.notification_response_rate, " %"],
            "followers":         [state.followers_count, ""],
            "following":         [state.following_count, ""],
            "linked-accounts":   [state.linked_accounts_count, ""],
            "days-since-login":  [state.days_since_last_login, " d"]
        };

        for (const [id, [val, unit]] of Object.entries(sliderMap)) {
            const slider = document.getElementById(`slider-${id}`);
            const valLabel = document.getElementById(`val-${id}`);
            if (slider) slider.value = val;
            if (valLabel) {
                valLabel.textContent = `${val}${unit}`;
                _applyLabelColor(valLabel, id.replace("-", "_"), val);
            }
        }

        // Đồng bộ các trường hiển thị tự động tính toán
        const calculatedFields = {
            "val-daily-active-mins":  [`${state.daily_active_minutes_instagram} m`, "daily_active_minutes_instagram", state.daily_active_minutes_instagram],
            "val-avg-session-len":    [`${state.average_session_length_minutes} m`, "average_session_length_minutes", state.average_session_length_minutes],
            "val-interact-density":   [state.interact_density.toFixed(3), "interact_density", state.interact_density],
            "val-interact-per-session": [state.interact_per_session.toFixed(3), "interact_per_session", state.interact_per_session],
            "val-dm-ratio":           [state.dm_ratio.toFixed(3), "dm_ratio", state.dm_ratio],
            "val-activity-per-session": [state.activity_per_session.toFixed(3), "activity_per_session", state.activity_per_session],
            "val-activity-intensity": [state.activity_intensity.toFixed(3), "activity_intensity", state.activity_intensity]
        };

        for (const [labelId, [textVal, stateKey, numericVal]] of Object.entries(calculatedFields)) {
            const el = document.getElementById(labelId);
            if (el) {
                el.textContent = textVal;
                _applyLabelColor(el, stateKey, numericVal);
            }
        }

        // Đồng bộ thanh tiến trình tổng active minutes
        const activeBar = document.getElementById("bar-daily-active-mins");
        if (activeBar) {
            const pct = Math.min((state.daily_active_minutes_instagram / 240) * 100, 100);
            activeBar.style.width = `${pct}%`;
            activeBar.className = `h-full rounded-full transition-all duration-300 ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-indigo-500'}`;
        }

        // Đồng bộ thanh tiến trình average session len
        const lenBar = document.getElementById("bar-avg-session-len");
        if (lenBar) {
            const pct = Math.min((state.average_session_length_minutes / 45) * 100, 100);
            lenBar.style.width = `${pct}%`;
        }

        // Đồng bộ hồ sơ cài đặt ở Tab Account
        const accFollowers = document.getElementById("acc-followers");
        const accFollowing = document.getElementById("acc-following");
        const accLinked = document.getElementById("acc-linked");
        const accLastLogin = document.getElementById("acc-last-login");

        if (accFollowers) accFollowers.value = state.followers_count;
        if (accFollowing) accFollowing.value = state.following_count;
        if (accLinked) accLinked.value = state.linked_accounts_count;
        if (accLastLogin) accLastLogin.value = state.days_since_last_login;
    }

    function _applyLabelColor(el, key, val) {
        const rule = THRESHOLDS[key];
        if (!rule) {
            el.className = el.className.replace(/\btext-(red|yellow|green|indigo)-\d+\b/g, '') + " text-slate-700";
            return;
        }
        el.className = el.className.replace(/\btext-(red|yellow|green|indigo|slate)-\d+\b/g, '').replace('font-bold', '').trim();
        if (val >= rule.danger) {
            el.classList.add("text-red-600", "font-bold");
        } else if (val >= rule.warn) {
            el.classList.add("text-yellow-600", "font-bold");
        } else {
            el.classList.add("text-green-600");
        }
    }

    // =========================================================
    // 3. TRACKING THEO THỜI GIAN THỰC (TAB ACTIVE CONTROLLERS)
    // =========================================================
    window.onTabChanged = function (tabId) {
        activeTabId = tabId;
        isPresetMode = false;
        document.getElementById("preset-mode-badge").classList.add("hidden");
        document.querySelectorAll(".preset-btn").forEach(btn => btn.classList.remove("ring-2", "ring-indigo-500", "bg-indigo-50/50"));
    };

    // Quy đổi: 1 giây thực tế = 1 phút sử dụng Instagram trong mô phỏng (cho demo trực quan nhanh)
    const TIME_SCALE_FACTOR = 1; 

    setInterval(function () {
        if (isPresetMode) return;

        let changed = false;
        if (activeTabId === "tab-feed") {
            state.time_on_feed_per_day += TIME_SCALE_FACTOR;
            // Mô phỏng số lượt xem ads ngẫu nhiên khi cuộn Feed lâu
            if (state.time_on_feed_per_day % 5 === 0) {
                state.ads_viewed_per_day += 1;
            }
            changed = true;
        } else if (activeTabId === "tab-explore") {
            state.time_on_explore_per_day += TIME_SCALE_FACTOR;
            changed = true;
        } else if (activeTabId === "tab-reels") {
            state.time_on_reels_per_day += TIME_SCALE_FACTOR;
            changed = true;
        } else if (activeTabId === "tab-messages") {
            state.time_on_messages_per_day += TIME_SCALE_FACTOR;
            changed = true;
        }

        if (changed) {
            recalculateDerived();
            syncStateToUI();
        }
    }, 1000);

    // =========================================================
    // 4. LẮNG NGHE TƯƠNG TÁC NGƯỜI DÙNG (SIMULATOR ACTIONS)
    // =========================================================

    // A. Bảng tin (Feed): Đăng bài
    const postForm = document.getElementById("post-form");
    if (postForm) {
        postForm.addEventListener("submit", function (e) {
            e.preventDefault();
            const text = document.getElementById("post-textarea");
            if (text && text.value.trim()) {
                isPresetMode = false;
                state.posts_created_per_week += 1;
                text.value = "";
                showToast("📝 Bài đăng của bạn đã được ghi nhận (+1 posts_created_per_week)!");
                recalculateDerived();
                syncStateToUI();
            }
        });
    }

    // B. Bảng tin (Feed): Click nút Thích bài viết
    document.addEventListener("click", function (e) {
        const btn = e.target.closest(".feed-like-btn");
        if (!btn) return;
        
        isPresetMode = false;
        const postCard = btn.closest(".post-card");
        const counter = postCard.querySelector(".like-counter");
        
        if (!btn.classList.contains("liked")) {
            btn.classList.add("liked", "text-red-500");
            state.likes_given_per_day += 1;
            if (counter) counter.textContent = parseInt(counter.textContent) + 1;
            showToast("❤️ Đã thích bài viết (+1 likes_given_per_day)");
        } else {
            btn.classList.remove("liked", "text-red-500");
            state.likes_given_per_day = Math.max(0, state.likes_given_per_day - 1);
            if (counter) counter.textContent = Math.max(0, parseInt(counter.textContent) - 1);
            showToast("💔 Đã bỏ thích bài viết (-1 likes_given_per_day)");
        }
        recalculateDerived();
        syncStateToUI();
    });

    // C. Bảng tin (Feed): Comment dưới bài viết
    document.addEventListener("submit", function (e) {
        if (!e.target.matches(".feed-comment-form")) return;
        e.preventDefault();
        const input = e.target.querySelector("input");
        if (input && input.value.trim()) {
            isPresetMode = false;
            state.comments_written_per_day += 1;
            input.value = "";
            showToast("💬 Đã gửi bình luận thành công (+1 comments_written_per_day)!");
            recalculateDerived();
            syncStateToUI();
        }
    });

    // D. Bảng tin (Feed): Xem / click quảng cáo
    const adBtn = document.getElementById("feed-ad-btn");
    if (adBtn) {
        adBtn.addEventListener("click", function () {
            isPresetMode = false;
            state.ads_clicked_per_day += 1;
            showToast("🎯 Bạn đã click vào quảng cáo tài trợ (+1 ads_clicked_per_day)!");
            recalculateDerived();
            syncStateToUI();
        });
    }

    // Trình theo dõi điểm cuộn qua quảng cáo (ads_viewed_per_day)
    let adCardObserved = false;
    const adCard = document.getElementById("feed-ad-card");
    if (adCard && window.IntersectionObserver) {
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !adCardObserved) {
                    isPresetMode = false;
                    state.ads_viewed_per_day += 1;
                    adCardObserved = true;
                    recalculateDerived();
                    syncStateToUI();
                    // Cho phép đếm lại sau 5 giây cuộn đi cuộn lại
                    setTimeout(() => { adCardObserved = false; }, 5000);
                }
            });
        }, { threshold: 0.3 });
        obs.observe(adCard);
    }

    // E. Khám phá (Explore): Thích ảnh trong lưới
    document.querySelectorAll(".explore-item").forEach(item => {
        item.addEventListener("click", function () {
            isPresetMode = false;
            state.likes_given_per_day += 1;
            showToast("🔍 Đã tương tác thích ảnh trên Explore (+1 likes_given_per_day)");
            recalculateDerived();
            syncStateToUI();
        });
    });

    // F. Reels: Xem clip và chuyển clip khác
    window.nextReel = function () {
        isPresetMode = false;
        state.reels_watched_per_day += 1;
        
        // Mô phỏng số quảng cáo Reels xuất hiện ngẫu nhiên
        if (Math.random() > 0.6) {
            state.ads_viewed_per_day += 1;
        }

        // Đổi ảnh ngẫu nhiên giả lập video Reels
        const img = document.getElementById("reel-placeholder");
        if (img) {
            const randIdx = Math.floor(Math.random() * 100);
            img.src = `https://picsum.photos/seed/reels_${randIdx}/360/640`;
        }

        // Bỏ active nút like Reel nếu đang thích
        const likeBtn = document.getElementById("reel-like-btn");
        if (likeBtn) likeBtn.classList.remove("bg-red-500");

        showToast("🎬 Đã xem xong 1 clip Reels (+1 reels_watched_per_day)");
        recalculateDerived();
        syncStateToUI();
    };

    const reelLikeBtn = document.getElementById("reel-like-btn");
    if (reelLikeBtn) {
        reelLikeBtn.addEventListener("click", function () {
            isPresetMode = false;
            state.likes_given_per_day += 1;
            this.classList.toggle("bg-red-500");
            showToast("❤️ Đã thích clip Reels này (+1 likes_given_per_day)");
            recalculateDerived();
            syncStateToUI();
        });
    }

    const reelCommentBtn = document.getElementById("reel-comment-btn");
    if (reelCommentBtn) {
        reelCommentBtn.addEventListener("click", function () {
            isPresetMode = false;
            state.comments_written_per_day += 1;
            showToast("💬 Ghi nhận bình luận nhanh clip Reels (+1 comments_written_per_day)");
            recalculateDerived();
            syncStateToUI();
        });
    }

    // G. Nhắn tin (Messages): Gửi tin nhắn và bot rep tự động
    const chatForm = document.getElementById("chat-input-form");
    const chatContainer = document.getElementById("chat-messages-container");
    if (chatForm && chatContainer) {
        chatForm.addEventListener("submit", function (e) {
            e.preventDefault();
            const input = document.getElementById("chat-input-text");
            if (input && input.value.trim()) {
                isPresetMode = false;
                const text = input.value.trim();
                
                // 1. Thêm bong bóng gửi đi
                const bubbleSent = document.createElement("div");
                bubbleSent.className = "flex justify-end";
                bubbleSent.innerHTML = `
                    <div class="bg-indigo-600 text-white text-xs px-3 py-2 rounded-2xl rounded-tr-none max-w-[80%] shadow-sm">
                        ${text}
                    </div>
                `;
                chatContainer.appendChild(bubbleSent);
                chatContainer.scrollTop = chatContainer.scrollHeight;
                input.value = "";

                // Cập nhật state gửi DM
                state.dms_sent_per_week += 1;
                recalculateDerived();
                syncStateToUI();

                // 2. Lên lịch trả lời tự động sau 1.5 giây
                setTimeout(function () {
                    state.dms_received_per_week += 1;
                    
                    const botReplies = [
                        "Tuyệt vời quá bạn ơi! 🌟",
                        "Uầy, cái này thú vị thật đấy!",
                        "Okie cậu, lát mình xem nhé!",
                        "Haha đúng rồi đó!",
                        "Ủng hộ nhiệt tình luôn nha 👍"
                    ];
                    const replyText = botReplies[Math.floor(Math.random() * botReplies.length)];

                    // Tạo bong bóng nhận
                    const bubbleRecv = document.createElement("div");
                    bubbleRecv.className = "flex gap-2";
                    bubbleRecv.innerHTML = `
                        <div class="w-6 h-6 rounded-full bg-purple-500 text-white text-[9px] font-bold flex-shrink-0 flex items-center justify-center">S</div>
                        <div class="bg-white border border-slate-100 text-slate-700 text-xs px-3 py-2 rounded-2xl rounded-tl-none max-w-[80%] shadow-sm">
                            ${replyText}
                        </div>
                    `;
                    chatContainer.appendChild(bubbleRecv);
                    chatContainer.scrollTop = chatContainer.scrollHeight;

                    // Đẩy thông báo DM nổi ở góc màn hình
                    showDMNotification("Sarah Connor", replyText);
                    recalculateDerived();
                    syncStateToUI();
                }, 1500);
            }
        });
    }

    // Bong bóng thông báo DM nổi ở góc
    function showDMNotification(sender, message) {
        const container = document.getElementById("notification-hub");
        if (!container) return;

        const notif = document.createElement("div");
        notif.className = "bg-slate-900 border border-slate-800 text-white p-3.5 rounded-2xl shadow-xl flex items-start gap-3 transform translate-y-10 opacity-0 transition duration-300 pointer-events-auto cursor-pointer";
        notif.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                ${sender[0]}
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-xs font-bold text-slate-100">${sender}</p>
                <p class="text-[11px] text-slate-400 truncate">${message}</p>
                <div class="flex gap-2 mt-1.5">
                    <button class="notif-reply-btn bg-indigo-600 hover:bg-indigo-700 text-[9px] font-bold px-2 py-0.5 rounded-md">Phản hồi nhanh</button>
                    <button class="notif-close-btn text-[9px] text-slate-500 hover:text-slate-300">Bỏ qua</button>
                </div>
            </div>
        `;

        container.appendChild(notif);
        
        // Hiện
        setTimeout(() => {
            notif.classList.remove("translate-y-10", "opacity-0");
        }, 50);

        // Nút phản hồi nhanh tăng response rate
        notif.querySelector(".notif-reply-btn").addEventListener("click", function (e) {
            e.stopPropagation();
            state.notification_response_rate = Math.min(100, state.notification_response_rate + 5);
            showToast("⚡ Đã tương tác phản hồi thông báo (+5% notification_response_rate)");
            switchTab("tab-messages");
            notif.remove();
            recalculateDerived();
            syncStateToUI();
        });

        // Nút đóng
        notif.querySelector(".notif-close-btn").addEventListener("click", function (e) {
            e.stopPropagation();
            // Không phản hồi hoặc phản hồi trễ làm giảm nhẹ tỉ lệ
            state.notification_response_rate = Math.max(0, state.notification_response_rate - 2);
            notif.remove();
            recalculateDerived();
            syncStateToUI();
        });

        // Hết hạn thông báo sau 8 giây
        setTimeout(() => {
            if (notif.parentNode) {
                state.notification_response_rate = Math.max(0, state.notification_response_rate - 1);
                notif.classList.add("translate-y-10", "opacity-0");
                setTimeout(() => notif.remove(), 300);
                recalculateDerived();
                syncStateToUI();
            }
        }, 8000);
    }

    // H. Lắng nghe cập nhật thủ công trên inputs của Tab Profile
    const accFollowers = document.getElementById("acc-followers");
    const accFollowing = document.getElementById("acc-following");
    const accLinked = document.getElementById("acc-linked");
    const accLastLogin = document.getElementById("acc-last-login");

    [accFollowers, accFollowing, accLinked, accLastLogin].forEach(el => {
        if (!el) return;
        el.addEventListener("input", function () {
            isPresetMode = false;
            state.followers_count = parseInt(accFollowers.value) || 0;
            state.following_count = parseInt(accFollowing.value) || 0;
            state.linked_accounts_count = parseInt(accLinked.value) || 0;
            state.days_since_last_login = parseInt(accLastLogin.value) || 0;
            recalculateDerived();
            syncStateToUI();
        });
    });

    // =========================================================
    // 5. LIÊN KẾT SLIDERS Ở CỘT PHẢI (TWO-WAY DATA BINDINGS)
    // =========================================================
    const sliders = [
        ["time-on-feed", "time_on_feed_per_day"],
        ["time-on-explore", "time_on_explore_per_day"],
        ["time-on-reels", "time_on_reels_per_day"],
        ["time-on-messages", "time_on_messages_per_day"],
        ["sessions-per-day", "sessions_per_day"],
        ["likes-given", "likes_given_per_day"],
        ["comments-written", "comments_written_per_day"],
        ["reels-watched", "reels_watched_per_day"],
        ["posts-created", "posts_created_per_week"],
        ["dms-sent", "dms_sent_per_week"],
        ["dms-received", "dms_received_per_week"],
        ["ads-viewed", "ads_viewed_per_day"],
        ["ads-clicked", "ads_clicked_per_day"],
        ["notif-rate", "notification_response_rate"],
        ["followers", "followers_count"],
        ["following", "following_count"],
        ["linked-accounts", "linked_accounts_count"],
        ["days-since-login", "days_since_last_login"]
    ];

    sliders.forEach(([id, key]) => {
        const slider = document.getElementById(`slider-${id}`);
        if (!slider) return;
        slider.addEventListener("input", function () {
            isPresetMode = false;
            state[key] = parseFloat(this.value) || 0;
            
            // Xử lý các Preset button khác
            document.querySelectorAll(".preset-btn").forEach(btn => btn.classList.remove("ring-2", "ring-indigo-500", "bg-indigo-50/50"));
            document.getElementById("preset-mode-badge").classList.add("hidden");

            recalculateDerived();
            syncStateToUI();
        });
    });

    // =========================================================
    // 6. XỬ LÝ PRESETS
    // =========================================================
    window.applyPreset = function (presetKey) {
        const preset = PRESETS[presetKey];
        if (!preset) return;

        // Sao chép các trường
        for (const [k, v] of Object.entries(preset)) {
            state[k] = v;
        }

        isPresetMode = true;

        // Đổi style button
        document.querySelectorAll(".preset-btn").forEach(btn => btn.classList.remove("ring-2", "ring-indigo-500", "bg-indigo-50/50"));
        const activeBtn = document.querySelector(`[data-preset="${presetKey}"]`);
        if (activeBtn) activeBtn.classList.add("ring-2", "ring-indigo-500", "bg-indigo-50/50");

        document.getElementById("preset-mode-badge").classList.remove("hidden");

        showToast(`🎭 Đã tải tập mẫu hành vi: ${presetKey.toUpperCase()}`);
        recalculateDerived();
        syncStateToUI();
    };

    window.resetPreset = function () {
        isPresetMode = false;
        document.getElementById("preset-mode-badge").classList.add("hidden");
        document.querySelectorAll(".preset-btn").forEach(btn => btn.classList.remove("ring-2", "ring-indigo-500", "bg-indigo-50/50"));

        // Reset về 0
        state.time_on_feed_per_day = 0;
        state.time_on_explore_per_day = 0;
        state.time_on_reels_per_day = 0;
        state.time_on_messages_per_day = 0;
        state.likes_given_per_day = 0;
        state.comments_written_per_day = 0;
        state.reels_watched_per_day = 0;
        state.posts_created_per_week = 0;
        state.dms_sent_per_week = 0;
        state.dms_received_per_week = 0;
        state.ads_viewed_per_day = 0;
        state.ads_clicked_per_day = 0;
        state.notification_response_rate = 50;
        state.followers_count = 500;
        state.following_count = 300;
        state.linked_accounts_count = 1;
        state.days_since_last_login = 1;

        showToast("🔄 Trả các tham số về không hoạt động");
        recalculateDerived();
        syncStateToUI();
    };

    // =========================================================
    // 7. GỬI PAYLOAD LÊN SERVER PHÂN TÍCH
    // =========================================================
    window.submitSession = async function () {
        const btn = document.getElementById("submit-btn");
        if (btn) {
            btn.disabled = true;
            btn.textContent = "Đang xử lý & phân cụm...";
        }

        recalculateDerived();

        // Chuẩn bị payload 25 tham số + Thuật toán
        const algorithm = document.querySelector('input[name="algorithm"]:checked')?.value || "kmeans";
        const payload = {
            ...state,
            algorithm: algorithm
        };

        console.log("[SocialSim API] Sending:", payload);

        try {
            const res = await fetch("/api/track_behavior", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
            
            const data = await res.json();
            console.log("[SocialSim API] Received:", data);

            // Hiển thị modal kết quả
            showResultModal(data.prediction, payload);
            
            // Tải lại bảng lịch sử
            loadSessionHistory();

        } catch (error) {
            console.error("[SocialSim API]", error);
            showToast("❌ Lỗi kết nối tới server Python!", "error");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = "🔬 Chốt Session & Phân Tích Hành Vi";
            }
        }
    };

    // =========================================================
    // 8. TẢI VÀ RENDER BẢNG LỊCH SỬ
    // =========================================================
    window.loadSessionHistory = async function () {
        try {
            const res = await fetch("/api/sessions");
            const data = await res.json();
            _renderHistory(data.sessions, data.total);
        } catch (error) {
            console.error("[Session History]", error);
        }
    };

    function _renderHistory(sessions, total) {
        const tbody = document.getElementById("history-tbody");
        const countEl = document.getElementById("history-count");
        const totalEl = document.getElementById("history-total");

        if (!tbody) return;

        if (countEl) countEl.textContent = sessions.length;
        if (totalEl) totalEl.textContent = total;

        if (!sessions.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-12 text-slate-400 text-xs">
                        Chưa có session nào được ghi nhận. Tương tác và bấm "Phân tích" để ghi nhận dữ liệu!
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = [...sessions].reverse().map(s => {
            const pred = s.prediction || {};
            const isAnomaly = pred.is_anomaly;
            
            const badge = isAnomaly
                ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">🚨 Anomaly</span>`
                : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-600 border border-green-200">✅ Normal</span>`;
            
            const algo = (s.algorithm || "kmeans").toLowerCase() === "dbscan"
                ? `<span class="text-[9px] bg-purple-50 text-purple-600 border border-purple-200 px-1.5 py-0.5 rounded-lg font-bold">DBSCAN</span>`
                : `<span class="text-[9px] bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-lg font-bold">K-Means</span>`;

            const activeMins = s.daily_active_minutes_instagram || 0;
            const intensity = s.activity_intensity || 0;
            const density = s.interact_density || 0;

            return `
                <tr class="hover:bg-slate-50 transition border-b border-slate-100">
                    <td class="py-3 px-4 text-slate-400 font-mono text-[10px]">${s.timestamp || ""}</td>
                    <td class="py-3 px-4 font-bold text-slate-700">${activeMins} m</td>
                    <td class="py-3 px-4 text-center font-semibold text-slate-600">${s.likes_given_per_day}</td>
                    <td class="py-3 px-4 text-center font-semibold text-slate-600">${s.comments_written_per_day}</td>
                    <td class="py-3 px-4 text-center font-semibold text-slate-600">${s.reels_watched_per_day}</td>
                    <td class="py-3 px-4 text-center font-bold font-mono text-indigo-600">${parseFloat(intensity).toFixed(2)}</td>
                    <td class="py-3 px-4 text-center font-bold font-mono text-purple-600">${parseFloat(density).toFixed(2)}</td>
                    <td class="py-3 px-4 text-center">${algo}</td>
                    <td class="py-3 px-4">${badge}</td>
                </tr>
            `;
        }).join("");
    }

    window.clearHistory = async function () {
        if (!confirm("Xóa toàn bộ lịch sử phân tích hành vi của user?")) return;
        await fetch("/api/clear_sessions", { method: "POST" });
        loadSessionHistory();
        showToast("🗑️ Đã xóa toàn bộ lịch sử!");
    };

    window.exportCSV = function () {
        window.location.href = "/api/export/csv";
    };

    // =========================================================
    // 9. MODAL KẾT QUẢ VÀ RADAR CHART (8 CORE DIMENSIONS)
    // =========================================================
    let radarChartObj = null;

    function showResultModal(prediction, payload) {
        const modal = document.getElementById("result-modal");
        const isAnomaly = prediction?.is_anomaly;

        // Cập nhật Header
        const header = document.getElementById("modal-header");
        const icon = document.getElementById("modal-icon");
        const title = document.getElementById("modal-title");
        const subtitle = document.getElementById("modal-subtitle");
        const metaEl = document.getElementById("modal-meta");

        if (isAnomaly) {
            header.className = "p-6 rounded-t-3xl border-b border-red-100 bg-gradient-to-tr from-red-50 to-orange-50";
            icon.textContent = "🚨";
            title.textContent = "Phát hiện Hành vi Bất thường (Anomaly)!";
            title.className = "text-xl font-black text-red-600 mt-2";
            subtitle.textContent = prediction.label || "";
            subtitle.className = "text-sm text-red-500 font-bold mt-1";
        } else {
            header.className = "p-6 rounded-t-3xl border-b border-green-100 bg-gradient-to-tr from-green-50 to-emerald-50";
            icon.textContent = "✅";
            title.textContent = "Hành vi Bình thường (Normal User)";
            title.className = "text-xl font-black text-green-600 mt-2";
            subtitle.textContent = prediction.label || "";
            subtitle.className = "text-sm text-green-500 font-bold mt-1";
        }

        if (metaEl) {
            const algo = prediction?.algorithm || payload.algorithm?.toUpperCase() || "K-MEANS";
            const cid = prediction?.cluster_id ?? "N/A";
            const conf = prediction?.confidence;
            metaEl.innerHTML = `
                <span class="bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 px-3 py-1 rounded-full text-[10px] uppercase">${algo}</span>
                <span class="bg-slate-100 text-slate-600 font-bold border border-slate-200 px-3 py-1 rounded-full text-[10px]">Cụm: ${cid}</span>
                ${conf != null ? `<span class="bg-pink-100 text-pink-700 font-bold border border-pink-200 px-3 py-1 rounded-full text-[10px]">Độ tin cậy: ${(conf*100).toFixed(0)}%</span>` : ""}
            `;
        }

        // Feature Breakdown Table (đủ 25 hàng)
        _renderModalBreakdown(payload);

        // Radar Chart (8 chiều)
        _renderModalRadar(payload);

        // Lý do bất thường
        _renderModalSuspicious(prediction?.suspicious_features || []);

        modal.classList.remove("hidden");
    }

    function _renderModalBreakdown(payload) {
        const tbody = document.getElementById("modal-features");
        if (!tbody) return;

        // Danh sách 25 tham số hiển thị đẹp đẽ
        const fields = [
            ["daily_active_minutes_instagram", "Tổng thời gian Instagram", " m"],
            ["time_on_feed_per_day", "Thời gian xem Feed/ngày", " m"],
            ["time_on_explore_per_day", "Thời gian xem Explore/ngày", " m"],
            ["time_on_reels_per_day", "Thời gian xem Reels/ngày", " m"],
            ["time_on_messages_per_day", "Thời gian nhắn tin/ngày", " m"],
            ["sessions_per_day", "Số phiên truy cập/ngày", ""],
            ["average_session_length_minutes", "Thời gian mỗi phiên", " m"],
            ["likes_given_per_day", "Lượt thích đã trao/ngày", ""],
            ["comments_written_per_day", "Lượt bình luận gửi/ngày", ""],
            ["reels_watched_per_day", "Reels đã xem/ngày", ""],
            ["posts_created_per_week", "Bài viết đăng/tuần", ""],
            ["dms_sent_per_week", "Tin nhắn DM gửi/tuần", ""],
            ["dms_received_per_week", "Tin nhắn DM nhận/tuần", ""],
            ["ads_viewed_per_day", "Lượt quảng cáo hiển thị/ngày", ""],
            ["ads_clicked_per_day", "Lượt click quảng cáo/ngày", ""],
            ["notification_response_rate", "Tỉ lệ phản hồi thông báo", " %"],
            ["followers_count", "Người theo dõi", ""],
            ["following_count", "Đang theo dõi", ""],
            ["linked_accounts_count", "Tài khoản liên kết", ""],
            ["days_since_last_login", "Số ngày nghỉ login", " d"],
            ["interact_density", "Mật độ tương tác (m/m)", ""],
            ["interact_per_session", "Tương tác mỗi phiên", ""],
            ["dm_ratio", "Tỉ lệ DM gửi/nhận", ""],
            ["activity_per_session", "Tổng hoạt động mỗi phiên", ""],
            ["activity_intensity", "Cường độ hoạt động (m/m)", ""]
        ];

        tbody.innerHTML = fields.map(([key, label, unit]) => {
            const val = payload[key];
            const rule = THRESHOLDS[key];
            let statusBadge = `<span class="bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-md">✓ Bình thường</span>`;
            let valColor = "text-slate-700";

            if (rule) {
                if (val >= rule.danger) {
                    statusBadge = `<span class="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-md font-bold">⚠️ Nguy hiểm</span>`;
                    valColor = "text-red-600 font-bold";
                } else if (val >= rule.warn) {
                    statusBadge = `<span class="bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-md font-bold">⚡ Đáng ngờ</span>`;
                    valColor = "text-yellow-600 font-bold";
                }
            }

            let formattedVal = typeof val === "number" ? (val % 1 !== 0 ? val.toFixed(3) : val) : val;

            return `
                <tr class="hover:bg-slate-50 transition">
                    <td class="py-2.5 px-3 font-semibold text-slate-800 text-left">${label} <span class="text-[9px] text-slate-400 font-normal">(${key})</span></td>
                    <td class="py-2.5 px-3 font-bold font-mono text-right ${valColor}">${formattedVal}${unit}</td>
                    <td class="py-2.5 px-3 text-center">${statusBadge}</td>
                </tr>
            `;
        }).join("");
    }

    function _renderModalRadar(payload) {
        const canvas = document.getElementById("radar-chart");
        if (!canvas || typeof Chart === "undefined") return;

        if (radarChartObj) {
            radarChartObj.destroy();
            radarChartObj = null;
        }

        // Chuẩn hóa 8 chiều cốt lõi về thang đo [0, 1]
        const normalizedValues = [
            Math.min(payload.daily_active_minutes_instagram / RADAR_MAX.daily_active_minutes_instagram, 1),
            Math.min(payload.sessions_per_day / RADAR_MAX.sessions_per_day, 1),
            Math.min(payload.likes_given_per_day / RADAR_MAX.likes_given_per_day, 1),
            Math.min(payload.reels_watched_per_day / RADAR_MAX.reels_watched_per_day, 1),
            Math.min(payload.ads_clicked_per_day / RADAR_MAX.ads_clicked_per_day, 1),
            Math.min(payload.followers_count / RADAR_MAX.followers_count, 1),
            Math.min(payload.interact_density / RADAR_MAX.interact_density, 1),
            Math.min(payload.activity_intensity / RADAR_MAX.activity_intensity, 1)
        ];

        radarChartObj = new Chart(canvas, {
            type: "radar",
            data: {
                labels: [
                    "Thời gian dùng",
                    "Số phiên/ngày",
                    "Lượt thích",
                    "Xem Reels",
                    "Click Ads",
                    "Followers",
                    "Mật độ t.tác",
                    "Cường độ h.động"
                ],
                datasets: [
                    {
                        label: "Người dùng hiện tại",
                        data: normalizedValues,
                        backgroundColor: "rgba(99, 102, 241, 0.25)",
                        borderColor: "rgb(99, 102, 241)",
                        borderWidth: 2,
                        pointBackgroundColor: "rgb(99, 102, 241)",
                        pointRadius: 4
                    },
                    {
                        label: "Tham chiếu chuẩn",
                        data: NORMAL_REF_PROFILE,
                        backgroundColor: "rgba(34, 197, 94, 0.08)",
                        borderColor: "rgb(34, 197, 94)",
                        borderWidth: 1.5,
                        borderDash: [4, 4],
                        pointRadius: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: { font: { size: 9, weight: "bold" }, color: "#475569" }
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 1,
                        ticks: { display: false },
                        grid: { color: "rgba(148, 163, 184, 0.15)" },
                        angleLines: { color: "rgba(148, 163, 184, 0.15)" },
                        pointLabels: { font: { size: 9, weight: "bold" }, color: "#64748b" }
                    }
                }
            }
        });
    }

    function _renderModalSuspicious(reasons) {
        const el = document.getElementById("modal-suspicious");
        if (!el) return;

        if (!reasons.length) {
            el.classList.add("hidden");
            return;
        }

        el.classList.remove("hidden");
        el.innerHTML = `
            <p class="text-xs font-extrabold text-red-700 flex items-center gap-1">
                🔍 Dấu hiệu bất thường nổi bật phát hiện bởi ML Service:
            </p>
            <ul class="text-[11px] text-red-600 list-disc list-inside mt-1.5 space-y-1 font-medium">
                ${reasons.map(r => `<li>${r}</li>`).join("")}
            </ul>
        `;
    }

    window.closeResultModal = function () {
        const modal = document.getElementById("result-modal");
        if (modal) modal.classList.add("hidden");
    };

    // =========================================================
    // 10. TOAST & CÁC HÀM TIỆN ÍCH KHÁC
    // =========================================================
    function showToast(message, type = "success") {
        const container = document.getElementById("toast-container");
        if (!container) return;

        const toast = document.createElement("div");
        toast.className = `flex items-center gap-2 ${type === "error" ? "bg-red-500" : "bg-slate-900"} text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-xl transition-all duration-300 opacity-100 translate-y-3`;
        toast.innerHTML = `
            <span>${type === "error" ? "❌" : "🔔"}</span>
            <span>${message}</span>
        `;
        container.appendChild(toast);
        
        // Hoạt ảnh xuất hiện
        setTimeout(() => {
            toast.classList.remove("translate-y-3");
        }, 50);

        // Hoạt ảnh biến mất
        setTimeout(() => {
            toast.classList.add("opacity-0", "translate-y-3");
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // =========================================================
    // 11. BẮT ĐẦU CHẠY (INITIALIZATION)
    // =========================================================
    recalculateDerived();
    syncStateToUI();
    loadSessionHistory();

})();
