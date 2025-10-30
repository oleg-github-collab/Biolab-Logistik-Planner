const logger = require('../utils/logger');

const safeParseJson = (value, fallback) => {
  if (value === null || value === undefined) return fallback;
  if (Array.isArray(fallback) && Array.isArray(value)) return value;
  if (typeof fallback === 'object' && !Array.isArray(fallback) && value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(fallback)) {
        return Array.isArray(parsed) ? parsed : fallback;
      }
      if (typeof fallback === 'object' && !Array.isArray(fallback)) {
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
      }
      return parsed;
    } catch (error) {
      return fallback;
    }
  }
  return fallback;
};

const normalizeMessageRow = (row) => {
  if (!row) return row;
  return {
    ...row,
    attachments: safeParseJson(row.attachments, []),
    metadata: safeParseJson(row.metadata, {}),
    reactions: row.reactions || [],
    mentions: row.mentions || [],
    calendar_refs: row.calendar_refs || [],
    task_refs: row.task_refs || [],
    quote: row.quote || null
  };
};

const buildAggregations = async (client, messageIds) => {
  const empty = {
    reactions: new Map(),
    quotes: new Map(),
    mentions: new Map(),
    calendarRefs: new Map(),
    taskRefs: new Map()
  };

  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return empty;
  }

  const ids = messageIds.map((id) => Number(id)).filter((id) => Number.isInteger(id));
  if (ids.length === 0) {
    return empty;
  }

  const params = [ids];

  const [reactionRes, quoteRes, mentionRes, calendarRes, taskRes] = await Promise.all([
    client.query(
      `SELECT
         mr.message_id,
         mr.emoji,
         COUNT(*)::INT AS count,
         json_agg(json_build_object(
           'user_id', u.id,
           'user_name', u.name,
           'user_photo', u.profile_photo,
           'created_at', mr.created_at
         ) ORDER BY mr.created_at ASC) AS users
       FROM message_reactions mr
       LEFT JOIN users u ON mr.user_id = u.id
       WHERE mr.message_id = ANY($1::int[])
       GROUP BY mr.message_id, mr.emoji`,
      params
    ),
    client.query(
      `SELECT
         mq.message_id,
         mq.quoted_message_id,
         mq.snippet,
         mq.created_at,
         qm.message AS quoted_message,
         qm.message_type AS quoted_message_type,
         qm.sender_id AS quoted_sender_id,
         qu.name AS quoted_sender_name,
         qu.profile_photo AS quoted_sender_photo
       FROM message_quotes mq
       LEFT JOIN messages qm ON mq.quoted_message_id = qm.id
       LEFT JOIN users qu ON qm.sender_id = qu.id
       WHERE mq.message_id = ANY($1::int[])`,
      params
    ),
    client.query(
      `SELECT
         mm.message_id,
         mm.id,
         mm.mentioned_user_id,
         mm.mentioned_by,
         mm.is_read,
         mm.created_at,
         mm.read_at,
         mentioned.name AS mentioned_user_name,
         mentioned.profile_photo AS mentioned_user_photo,
         author.name AS mentioned_by_name
       FROM message_mentions mm
       LEFT JOIN users mentioned ON mm.mentioned_user_id = mentioned.id
       LEFT JOIN users author ON mm.mentioned_by = author.id
       WHERE mm.message_id = ANY($1::int[])
       ORDER BY mm.created_at ASC`,
      params
    ),
    client.query(
      `SELECT
         mcr.message_id,
         mcr.id,
         mcr.event_id,
         mcr.ref_type,
         mcr.created_at,
         ce.title AS event_title,
         ce.start_time AS event_start_time,
         ce.end_time AS event_end_time
       FROM message_calendar_refs mcr
       LEFT JOIN calendar_events ce ON mcr.event_id = ce.id
       WHERE mcr.message_id = ANY($1::int[])
       ORDER BY mcr.created_at ASC`,
      params
    ),
    client.query(
      `SELECT
         mtr.message_id,
         mtr.id,
         mtr.task_id,
         mtr.ref_type,
         mtr.created_at,
         t.title AS task_title,
         t.status AS task_status,
         t.priority AS task_priority
       FROM message_task_refs mtr
       LEFT JOIN tasks t ON mtr.task_id = t.id
       WHERE mtr.message_id = ANY($1::int[])
       ORDER BY mtr.created_at ASC`,
      params
    )
  ]);

  const result = {
    reactions: new Map(),
    quotes: new Map(),
    mentions: new Map(),
    calendarRefs: new Map(),
    taskRefs: new Map()
  };

  reactionRes.rows.forEach((row) => {
    const entry = result.reactions.get(row.message_id) || [];
    entry.push({
      emoji: row.emoji,
      count: Number(row.count) || 0,
      users: Array.isArray(row.users) ? row.users : []
    });
    result.reactions.set(row.message_id, entry);
  });

  quoteRes.rows.forEach((row) => {
    result.quotes.set(row.message_id, {
      quoted_message_id: row.quoted_message_id,
      snippet: row.snippet || row.quoted_message?.slice(0, 280) || null,
      created_at: row.created_at,
      quoted_message: row.quoted_message,
      quoted_message_type: row.quoted_message_type,
      quoted_sender_id: row.quoted_sender_id,
      quoted_sender_name: row.quoted_sender_name,
      quoted_sender_photo: row.quoted_sender_photo
    });
  });

  mentionRes.rows.forEach((row) => {
    const entry = result.mentions.get(row.message_id) || [];
    entry.push({
      id: row.id,
      mentioned_user_id: row.mentioned_user_id,
      mentioned_user_name: row.mentioned_user_name,
      mentioned_user_photo: row.mentioned_user_photo,
      mentioned_by: row.mentioned_by,
      mentioned_by_name: row.mentioned_by_name,
      is_read: row.is_read,
      created_at: row.created_at,
      read_at: row.read_at
    });
    result.mentions.set(row.message_id, entry);
  });

  calendarRes.rows.forEach((row) => {
    const entry = result.calendarRefs.get(row.message_id) || [];
    entry.push({
      id: row.id,
      event_id: row.event_id,
      ref_type: row.ref_type,
      created_at: row.created_at,
      event_title: row.event_title,
      event_start_time: row.event_start_time,
      event_end_time: row.event_end_time
    });
    result.calendarRefs.set(row.message_id, entry);
  });

  taskRes.rows.forEach((row) => {
    const entry = result.taskRefs.get(row.message_id) || [];
    entry.push({
      id: row.id,
      task_id: row.task_id,
      ref_type: row.ref_type,
      created_at: row.created_at,
      task_title: row.task_title,
      task_status: row.task_status,
      task_priority: row.task_priority
    });
    result.taskRefs.set(row.message_id, entry);
  });

  return result;
};

const mergeAggregations = (rows, aggregates) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  return rows.map((row) => {
    const normalized = normalizeMessageRow(row);
    const messageId = row.id;
    return {
      ...normalized,
      reactions: aggregates.reactions.get(messageId) || [],
      quote: aggregates.quotes.get(messageId) || null,
      mentions: aggregates.mentions.get(messageId) || [],
      calendar_refs: aggregates.calendarRefs.get(messageId) || [],
      task_refs: aggregates.taskRefs.get(messageId) || []
    };
  });
};

const enrichMessages = async (client, rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const messageIds = rows.map((row) => row.id);
  const aggregates = await buildAggregations(client, messageIds);
  return mergeAggregations(rows, aggregates);
};

const createMessageRecord = async (client, {
  senderId,
  conversationId,
  receiverId,
  messageContent,
  messageType,
  attachments = [],
  metadata = {},
  quotedMessageId = null,
  mentionedUserIds = []
}) => {
  const sanitizedMetadata = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? { ...metadata }
    : {};

  if (quotedMessageId) {
    sanitizedMetadata.quoted_message_id = quotedMessageId;
  }

  const insertResult = await client.query(
    `INSERT INTO messages (
       sender_id,
       receiver_id,
       conversation_id,
       message,
       message_type,
       read_status,
       attachments,
       metadata,
       created_at
     ) VALUES ($1, $2, $3, $4, $5, false, $6::jsonb, $7::jsonb, CURRENT_TIMESTAMP)
     RETURNING *`,
    [
      senderId,
      receiverId,
      conversationId,
      messageContent,
      messageType,
      JSON.stringify(Array.isArray(attachments) ? attachments : []),
      JSON.stringify(sanitizedMetadata)
    ]
  );

  const message = insertResult.rows[0];

  if (quotedMessageId) {
    let snippet = null;
    try {
      const quoted = await client.query(
        'SELECT message FROM messages WHERE id = $1',
        [quotedMessageId]
      );
      snippet = quoted.rows[0]?.message ? quoted.rows[0].message.slice(0, 280) : null;
    } catch (error) {
      logger.warn('Failed to load quoted message snippet', { quotedMessageId, error: error.message });
    }

    await client.query(
      `INSERT INTO message_quotes (message_id, quoted_message_id, quoted_by, snippet)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [message.id, quotedMessageId, senderId, snippet]
    );
  }

  if (Array.isArray(mentionedUserIds) && mentionedUserIds.length > 0) {
    const uniqueMentions = Array.from(new Set(
      mentionedUserIds
        .map((id) => parseInt(id, 10))
        .filter((id) => Number.isInteger(id) && id !== senderId)
    ));

    for (const mentionedId of uniqueMentions) {
      await client.query(
        `INSERT INTO message_mentions (message_id, mentioned_user_id, mentioned_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (message_id, mentioned_user_id) DO NOTHING`,
        [message.id, mentionedId, senderId]
      );
    }
  }

  return message;
};

module.exports = {
  safeParseJson,
  normalizeMessageRow,
  enrichMessages,
  createMessageRecord
};
