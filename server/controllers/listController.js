import db from "../config/db.js";
import { formatCommentText } from "../utils/helpers.js";

export const renderListsPage = (req, res) => {
  try {
    res.render("lists.ejs");
  } catch (error) {
    res.status(500).send("Server Error");
  }
};

export const exploreListsApi = async (req, res) => {
  try {
    const { search = "", filter = "Popular", page = 1 } = req.query;
    const limit = 12;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;
    const currentUserId = req.user ? req.user.id : -1;

    let queryParams = [];
    let whereClauses = ["l.is_private = false"];

    if (search.trim() !== "") {
      whereClauses.push(`l.title ILIKE $${queryParams.length + 1}`);
      queryParams.push(`%${search.trim()}%`);
    }

    if (filter === "Following" && req.user) {
      whereClauses.push(
        `l.user_id IN (SELECT following_id FROM followers WHERE follower_id = $${queryParams.length + 1})`,
      );
      queryParams.push(req.user.id);
    }

    const whereString =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    let orderBy =
      filter === "Popular"
        ? "likes_count DESC, l.created_at DESC"
        : "l.created_at DESC";

    const query = `
            SELECT l.id AS list_id, l.title, l.created_at, u.username,
                (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id) AS total_items,
                (SELECT COUNT(*) FROM list_likes ll WHERE ll.list_id = l.id) AS likes_count,
                (SELECT COUNT(*) FROM list_comments lc WHERE lc.list_id = l.id) AS comments_count,
                EXISTS(SELECT 1 FROM list_likes ll WHERE ll.list_id = l.id AND ll.user_id = ${currentUserId}) AS is_liked_by_user,
                COALESCE((SELECT json_agg(sub.poster_path) FROM (SELECT mc.poster_path FROM list_items li2 JOIN media_cache mc ON li2.tmdb_id = mc.tmdb_id AND li2.media_type = mc.media_type WHERE li2.list_id = l.id ORDER BY li2.order_index ASC LIMIT 4) sub), '[]'::json) AS preview_posters
            FROM lists l JOIN users u ON l.user_id = u.id ${whereString} ORDER BY ${orderBy} LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
        `;
    queryParams.push(limit, offset);
    const result = await db.query(query, queryParams);

    const countResult = await db.query(
      `SELECT COUNT(*) FROM lists l ${whereString}`,
      queryParams.slice(0, -2),
    );
    const totalPages = Math.max(
      1,
      Math.ceil(parseInt(countResult.rows[0].count) / limit),
    );

    res.json({ lists: result.rows, currentPage: parseInt(page), totalPages });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

export const renderSingleList = async (req, res) => {
  try {
    const listId = req.query.id;
    if (!listId) return res.redirect("/");

    const listRes = await db.query(
      `
            SELECT l.id, l.title, l.is_private, l.user_id, l.created_at, l.updated_at, u.username, p.avatar_url,
            (SELECT COUNT(*) FROM list_likes ll WHERE ll.list_id = l.id) as likes_count,
            ${req.user ? `EXISTS (SELECT 1 FROM list_likes ll WHERE ll.list_id = l.id AND ll.user_id = ${req.user.id})` : "false"} as is_liked_by_user
            FROM lists l JOIN users u ON l.user_id = u.id LEFT JOIN user_profiles p ON u.id = p.user_id WHERE l.id = $1
        `,
      [listId],
    );

    if (listRes.rows.length === 0)
      return res.status(404).send("List not found");
    const list = listRes.rows[0];

    if (list.is_private && (!req.user || req.user.id !== list.user_id))
      return res.status(403).send("Sorry, this list is private.");

    const currentUserId = req.user ? req.user.id : -1;
    const itemsRes = await db.query(
      `
            SELECT li.tmdb_id, li.media_type, li.order_index, mc.title, mc.poster_path, mc.rating, mc.is_anime,
            EXISTS(SELECT 1 FROM liked_media lm WHERE lm.user_id = $2 AND lm.tmdb_id = li.tmdb_id AND lm.media_type = li.media_type) as is_liked,
            EXISTS(SELECT 1 FROM watchlist w WHERE w.user_id = $2 AND w.tmdb_id = li.tmdb_id AND w.media_type = li.media_type) as is_watchlisted
            FROM list_items li JOIN media_cache mc ON li.tmdb_id = mc.tmdb_id AND li.media_type = mc.media_type
            WHERE li.list_id = $1 ORDER BY li.order_index ASC
        `,
      [listId, currentUserId],
    );

    let watchedCount = 0;
    if (req.user && itemsRes.rows.length > 0) {
      const watchedRes = await db.query(
        `SELECT COUNT(DISTINCT li.tmdb_id) as count FROM list_items li JOIN reviews r ON li.tmdb_id = r.tmdb_id AND li.media_type = r.media_type WHERE li.list_id = $1 AND r.user_id = $2`,
        [listId, req.user.id],
      );
      watchedCount = parseInt(watchedRes.rows[0].count) || 0;
    }

    const commentsRes = await db.query(
      `
            SELECT c.id, c.content, c.created_at, c.parent_comment_id, u.username, p.avatar_url,
            (SELECT COUNT(*) FROM list_comment_likes cl WHERE cl.comment_id = c.id) as likes_count,
            ${req.user ? `EXISTS (SELECT 1 FROM list_comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = ${req.user.id})` : "false"} as is_liked_by_user
            FROM list_comments c JOIN users u ON c.user_id = u.id LEFT JOIN user_profiles p ON u.id = p.user_id
            WHERE c.list_id = $1 ORDER BY c.created_at ASC
        `,
      [listId],
    );

    const allComments = commentsRes.rows.map((c) => ({
      ...c,
      content: formatCommentText(c.content),
      replies: [],
    }));
    const mainComments = [];
    const commentMap = {};
    allComments.forEach((c) => (commentMap[c.id] = c));
    allComments.forEach((c) =>
      c.parent_comment_id && commentMap[c.parent_comment_id]
        ? commentMap[c.parent_comment_id].replies.push(c)
        : mainComments.push(c),
    );

    res.render("single-list.ejs", {
      list,
      listItems: itemsRes.rows,
      isOwner: req.user && req.user.id === list.user_id,
      watchedCount,
      mainComments,
      commentsCount: allComments.length,
    });
  } catch (error) {
    res.status(500).send("Server Error");
  }
};

export const createList = async (req, res) => {
  const { title, is_private, items } = req.body;
  if (!title?.trim())
    return res.status(400).json({ error: "List title is required." });

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const listResult = await client.query(
      `INSERT INTO lists (user_id, title, is_private) VALUES ($1, $2, $3) RETURNING id`,
      [req.user.id, title.trim(), is_private],
    );
    const newListId = listResult.rows[0].id;

    if (items?.length) {
      for (const item of items) {
        await client.query(
          `INSERT INTO media_cache (tmdb_id, media_type, title, poster_path, rating) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (tmdb_id, media_type) DO UPDATE SET rating = EXCLUDED.rating WHERE media_cache.rating IS NULL`,
          [
            item.tmdb_id,
            item.media_type,
            item.title,
            item.poster_path,
            item.rating,
          ],
        );
        await client.query(
          `INSERT INTO list_items (list_id, tmdb_id, media_type, order_index) VALUES ($1, $2, $3, $4)`,
          [newListId, item.tmdb_id, item.media_type, item.order_index],
        );
      }
    }
    await client.query("COMMIT");
    res
      .status(200)
      .json({ message: "List created successfully", list_id: newListId });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Internal server error." });
  } finally {
    client.release();
  }
};

export const deleteList = async (req, res) => {
  try {
    const userRes = await db.query("SELECT username FROM users WHERE id = $1", [
      req.user.id,
    ]);
    await db.query("DELETE FROM list_items WHERE list_id = $1", [
      req.params.id,
    ]);
    const delRes = await db.query(
      "DELETE FROM lists WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id],
    );
    if (delRes.rowCount > 0)
      res
        .status(200)
        .json({ message: "List deleted", username: userRes.rows[0].username });
    else res.status(403).json({ error: "Permission denied." });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

export const updateList = async (req, res) => {
  const { title, is_private, items } = req.body;
  try {
    await db.query("BEGIN");
    const updateListRes = await db.query(
      "UPDATE lists SET title = $1, is_private = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4 RETURNING id",
      [title, is_private, req.params.id, req.user.id],
    );
    if (updateListRes.rowCount === 0) {
      await db.query("ROLLBACK");
      return res.status(403).json({ error: "Unauthorized" });
    }

    await db.query("DELETE FROM list_items WHERE list_id = $1", [
      req.params.id,
    ]);
    for (const item of items) {
      await db.query(
        `INSERT INTO media_cache (tmdb_id, media_type, title, poster_path, rating) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (tmdb_id, media_type) DO UPDATE SET rating = EXCLUDED.rating WHERE media_cache.rating IS NULL`,
        [
          item.tmdb_id,
          item.media_type,
          item.title,
          item.poster_path,
          item.rating,
        ],
      );
      await db.query(
        "INSERT INTO list_items (list_id, tmdb_id, media_type, order_index) VALUES ($1, $2, $3, $4)",
        [req.params.id, item.tmdb_id, item.media_type, item.order_index],
      );
    }
    await db.query("COMMIT");
    res.status(200).json({ message: "List updated" });
  } catch (error) {
    await db.query("ROLLBACK");
    res.status(500).json({ error: "Server error" });
  }
};

export const toggleListLike = async (req, res) => {
  try {
    const checkResult = await db.query(
      "SELECT id FROM list_likes WHERE list_id = $1 AND user_id = $2",
      [req.params.id, req.user.id],
    );
    if (checkResult.rows.length > 0) {
      await db.query("DELETE FROM list_likes WHERE id = $1", [
        checkResult.rows[0].id,
      ]);
      res.json({ status: "removed" });
    } else {
      await db.query(
        "INSERT INTO list_likes (list_id, user_id) VALUES ($1, $2)",
        [req.params.id, req.user.id],
      );
      res.json({ status: "added" });
    }
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

export const addListComment = async (req, res) => {
  if (!req.body.content?.trim())
    return res.status(400).json({ error: "Empty comment" });
  try {
    const result = await db.query(
      `INSERT INTO list_comments (list_id, user_id, content, parent_comment_id) VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
      [
        req.params.id,
        req.user.id,
        req.body.content.trim(),
        req.body.parent_comment_id || null,
      ],
    );
    res
      .status(200)
      .json({
        message: "Comment added",
        comment_id: result.rows[0].id,
        created_at: result.rows[0].created_at,
        username: req.user.username,
        avatar_url: req.user.avatar_url,
      });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

export const toggleListCommentLike = async (req, res) => {
  try {
    const checkResult = await db.query(
      "SELECT id FROM list_comment_likes WHERE comment_id = $1 AND user_id = $2",
      [req.params.id, req.user.id],
    );
    if (checkResult.rows.length > 0) {
      await db.query("DELETE FROM list_comment_likes WHERE id = $1", [
        checkResult.rows[0].id,
      ]);
      res.json({ status: "removed" });
    } else {
      await db.query(
        "INSERT INTO list_comment_likes (comment_id, user_id) VALUES ($1, $2)",
        [req.params.id, req.user.id],
      );
      res.json({ status: "added" });
    }
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};
