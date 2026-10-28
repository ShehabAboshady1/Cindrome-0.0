-- 1. جدول الحسابات الأساسية 
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. جدول بيانات البروفايل 
CREATE TABLE user_profiles (
    user_id INT PRIMARY KEY,
    display_name VARCHAR(100),
    bio TEXT,
    avatar_url VARCHAR(255),
    backdrop_url VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. جدول إعدادات الحساب
CREATE TABLE user_settings (
    user_id INT PRIMARY KEY,
    is_private BOOLEAN DEFAULT FALSE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    notify_new_follower BOOLEAN DEFAULT TRUE,
    notify_review_interaction BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. جدول الأنواع المفضلة 
CREATE TABLE user_favorite_genres (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    genre VARCHAR(50) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. جدول الكاش للأعمال
CREATE TABLE media_cache (
    tmdb_id INT,
    media_type VARCHAR(10), 
    title VARCHAR(255) NOT NULL,
    poster_path VARCHAR(255),
    run_time INT,
    total_episodes INT,
    total_seasons INT,
    rating DECIMAL(3,1),
    is_anime BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (tmdb_id, media_type)
);

-- 6. جدول قائمة المشاهدة (Watchlist)
CREATE TABLE watchlist (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    tmdb_id INT NOT NULL,
    media_type VARCHAR(10) NOT NULL,
    status VARCHAR(50) DEFAULT 'plan_to_watch',
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tmdb_id, media_type) REFERENCES media_cache(tmdb_id, media_type) ON DELETE CASCADE
);

-- 7. جدول المفضلة (Liked Media)
CREATE TABLE liked_media (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    tmdb_id INT NOT NULL,
    media_type VARCHAR(10) NOT NULL,
    liked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tmdb_id, media_type) REFERENCES media_cache(tmdb_id, media_type) ON DELETE CASCADE,
    UNIQUE (user_id, tmdb_id, media_type)
);

-- 8. جدول المراجعات واليوميات (Reviews & Logs)
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tmdb_id INT NOT NULL,
    media_type VARCHAR(20) NOT NULL,
    rating DECIMAL(3,1), 
    review_text TEXT,
    is_rewatch BOOLEAN DEFAULT false,
    has_spoilers BOOLEAN DEFAULT false,
    liked BOOLEAN DEFAULT false, 
    season_number INT,
    episode_number INT,
    watch_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tmdb_id, media_type) REFERENCES media_cache(tmdb_id, media_type) ON DELETE CASCADE
);

-- 9. جدول المتابعين (Followers)
CREATE TABLE followers (
    id SERIAL PRIMARY KEY,
    follower_id INT NOT NULL,
    following_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(follower_id, following_id)
);
CREATE TABLE lists (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE list_items (
    id SERIAL PRIMARY KEY,
    list_id INTEGER REFERENCES lists(id) ON DELETE CASCADE,
    tmdb_id INTEGER NOT NULL,
    media_type VARCHAR(20) NOT NULL, 
    order_index INTEGER NOT NULL, 
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(list_id, tmdb_id, media_type)
);
-- ==========================================
-- 1. جدول إعجابات المراجعات (Review Likes)
-- ==========================================
CREATE TABLE review_likes (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    review_id INT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, review_id) -- يمنع اللايك المكرر لنفس الريفيو من نفس اليوزر
);

-- ==========================================
-- 2. جدول تعليقات المراجعات (Review Comments)
-- ==========================================
CREATE TABLE review_comments (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    review_id INT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    parent_comment_id INT REFERENCES review_comments(id) ON DELETE CASCADE, -- للردود المتداخلة
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 3. جدول إعجابات القوائم (List Likes)
-- ==========================================
CREATE TABLE list_likes (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    list_id INT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, list_id)
);

-- ==========================================
-- 4. جدول تعليقات القوائم (List Comments)
-- ==========================================
CREATE TABLE list_comments (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    list_id INT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    parent_comment_id INT REFERENCES list_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);