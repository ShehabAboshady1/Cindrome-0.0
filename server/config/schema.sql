CREATE TABLE users(
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_profiles (
    user_id INT PRIMARY KEY,
    display_name VARCHAR(100),
    bio TEXT,
    avatar_url VARCHAR(255),
    backdrop_url VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE user_settings (
    user_id INT PRIMARY KEY,
    is_private BOOLEAN DEFAULT FALSE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    notify_new_follower BOOLEAN DEFAULT TRUE,
    notify_review_interaction BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE user_favorite_genres (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    genre VARCHAR(50) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE media_cache (
    tmdb_id INT,
    media_type VARCHAR(10), 
    title VARCHAR(255) NOT NULL,
    poster_path VARCHAR(255),
    runtime INT DEFAULT 0,
    PRIMARY KEY (tmdb_id, media_type)
);

CREATE TABLE watchlist (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    tmdb_id INT NOT NULL,
    media_type VARCHAR(10) NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tmdb_id, media_type) REFERENCES media_cache(tmdb_id, media_type) ON DELETE CASCADE
);

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