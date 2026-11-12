import { ChatComment, ChatTopic, User, safeParseJsonArray } from '../types/index.ts';

type UserIdentityLike = Pick<User, 'id'> & Partial<Pick<User, 'email' | 'name'>>;

export function getUserMatchIdentifiers(user?: UserIdentityLike | null): string[] {
  if (!user) return [];
  const raw = [user.id, user.email, user.name];
  return Array.from(
    new Set(
      raw
        .map((v) => String(v || '').trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

export function isChatTopicHiddenForUser(
  topic: Pick<ChatTopic, 'id' | 'hiddenByIds'> & Record<string, unknown>,
  userId?: string | null,
  localHiddenIds: string[] = []
): boolean {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) return false;
  if (localHiddenIds.some((id) => String(id).trim() === topic.id)) {
    return true;
  }
  const hiddenByIds = safeParseJsonArray(
    topic.hiddenByIds ?? topic.hidden_by_ids ?? topic.dihapus_oleh_ids
  );
  return hiddenByIds.some((id) => String(id).trim() === normalizedUserId);
}

export function isChatTopicVisibleToUser(
  topic: ChatTopic,
  currentUser: UserIdentityLike | null | undefined,
  allUsers: UserIdentityLike[],
  localHiddenIds: string[] = []
): boolean {
  if (!currentUser?.id) return false;
  if (isChatTopicHiddenForUser(topic as ChatTopic & Record<string, unknown>, currentUser.id, localHiddenIds)) {
    return false;
  }

  const currentNameLower = currentUser.name ? currentUser.name.toLowerCase().trim() : '';
  const currentEmailLower = currentUser.email ? currentUser.email.toLowerCase().trim() : '';
  const currentIdLower = currentUser.id.toLowerCase().trim();

  const myIdentifiers = new Set<string>();
  if (currentIdLower) myIdentifiers.add(currentIdLower);
  if (currentEmailLower) myIdentifiers.add(currentEmailLower);
  if (currentNameLower) myIdentifiers.add(currentNameLower);

  (allUsers || []).forEach((u) => {
    const match =
      (currentUser.id && u.id === currentUser.id) ||
      (currentEmailLower && u.email && u.email.toLowerCase().trim() === currentEmailLower) ||
      (currentNameLower && u.name && u.name.toLowerCase().trim() === currentNameLower);
    if (match) {
      if (u.id) myIdentifiers.add(u.id.toLowerCase().trim());
      if (u.email) myIdentifiers.add(u.email.toLowerCase().trim());
      if (u.name) myIdentifiers.add(u.name.toLowerCase().trim());
    }
  });

  const tagged = safeParseJsonArray(
    topic.taggedTeammateIds ??
      (topic as unknown as Record<string, unknown>).id_anggota_ditandai ??
      (topic as unknown as Record<string, unknown>).tagged_teammate_ids
  );

  const isCreator =
    (topic.createdBy && myIdentifiers.has(topic.createdBy.toLowerCase().trim())) ||
    (topic.createdByName && myIdentifiers.has(topic.createdByName.toLowerCase().trim()));

  const isTagged = tagged.some((tagItem) => {
    if (!tagItem) return false;
    const cleanTag = String(tagItem).toLowerCase().trim();
    if (myIdentifiers.has(cleanTag)) return true;
    const matchedUser = (allUsers || []).find(
      (u) =>
        (u.id && u.id.toLowerCase().trim() === cleanTag) ||
        (u.email && u.email.toLowerCase().trim() === cleanTag) ||
        (u.name && u.name.toLowerCase().trim() === cleanTag)
    );
    if (matchedUser) {
      if (matchedUser.id && myIdentifiers.has(matchedUser.id.toLowerCase().trim())) return true;
      if (matchedUser.email && myIdentifiers.has(matchedUser.email.toLowerCase().trim())) return true;
      if (matchedUser.name && myIdentifiers.has(matchedUser.name.toLowerCase().trim())) return true;
    }
    return false;
  });

  return Boolean(isTagged || isCreator);
}

export function hasOtherChatParticipants(
  topic: ChatTopic,
  actingUserOrId: UserIdentityLike | string,
  allUsers: UserIdentityLike[]
): boolean {
  const actingId = typeof actingUserOrId === 'string' ? actingUserOrId : actingUserOrId.id;
  const actingUser =
    typeof actingUserOrId === 'string'
      ? allUsers.find((u) => u.id === actingUserOrId) || { id: actingUserOrId }
      : actingUserOrId;

  const hiddenSet = new Set([
    ...(topic.hiddenByIds || []).map((id) => String(id).trim()),
    String(actingId).trim(),
  ].filter(Boolean));

  const normalizedTags = new Set(
    (topic.taggedTeammateIds || [])
      .map((tag) => String(tag || '').trim().toLowerCase())
      .filter(Boolean)
  );

  if (allUsers.length > 0) {
    return allUsers.some((candidate) => {
      if (!candidate?.id || hiddenSet.has(String(candidate.id).trim())) return false;
      if (String(topic.createdBy || '').trim() === String(candidate.id).trim()) return true;
      return getUserMatchIdentifiers(candidate).some((identifier) => normalizedTags.has(identifier));
    });
  }

  // Fallback check when user directory is unavailable
  if (topic.createdBy && !hiddenSet.has(String(topic.createdBy).trim())) {
    return true;
  }
  const actingIdentifiers = new Set(getUserMatchIdentifiers(actingUser));
  return Array.from(normalizedTags).some((tag) => !actingIdentifiers.has(tag));
}

function isRecentLocalTopic(topic: ChatTopic, nowMs: number): boolean {
  const createdMs = topic.createdAt ? Date.parse(topic.createdAt) : NaN;
  if (!Number.isNaN(createdMs) && nowMs - createdMs < 30_000) {
    return true;
  }
  const numericId = Number(String(topic.id || '').replace(/^topic_/, ''));
  return !Number.isNaN(numericId) && numericId > 1_000_000_000_000 && nowMs - numericId < 30_000;
}

export function mapServerChatTopic(st: any, existingLocal?: ChatTopic): ChatTopic {
  const rawComments =
    Array.isArray(st.comments) && st.comments.length > 0
      ? st.comments
      : Array.isArray(st.messages)
      ? st.messages
      : st.comments || [];

  const mappedComments: ChatComment[] =
    Array.isArray(rawComments) && rawComments.length > 0
      ? rawComments.map((c: any) => ({
          id: c.id,
          topicId: c.topicId || c.topik_id || st.id,
          userId: c.userId || c.pengguna_id || '',
          userName: c.userName || c.nama_pengirim || '',
          userAvatar: c.userAvatar || c.foto_pengirim || '',
          userRole: c.userRole || c.peran_pengirim || 'EMPLOYEE',
          timestamp: c.timestamp || c.waktu_kirim || '',
          notes: c.notes || c.isi_pesan || c.content || '',
          attachments: Array.isArray(c.attachments)
            ? c.attachments
            : Array.isArray(c.lampiran)
            ? c.lampiran
            : [],
          type: 'COMMENT' as const,
        }))
      : existingLocal?.comments || [];

  return {
    ...(existingLocal || {}),
    id: st.id,
    title: st.title || st.judul_topik || '',
    status: (st.status || st.status_topik || 'NEED_COMMENTS') as ChatTopic['status'],
    taggedTeammateIds: safeParseJsonArray(
      st.taggedTeammateIds ?? st.id_anggota_ditandai ?? st.tagged_teammate_ids
    ),
    hiddenByIds: safeParseJsonArray(
      st.hiddenByIds ?? st.hidden_by_ids ?? st.dihapus_oleh_ids
    ),
    files: Array.isArray(st.files) ? st.files : Array.isArray(st.berkas) ? st.berkas : [],
    links: Array.isArray(st.links) ? st.links : Array.isArray(st.tautan) ? st.tautan : [],
    images: Array.isArray(st.images) ? st.images : Array.isArray(st.gambar) ? st.gambar : [],
    shortNotes: st.shortNotes || st.short_notes || st.catatan_singkat || '',
    longNotes: st.longNotes || st.long_notes || st.catatan_lengkap || '',
    createdBy: st.createdBy || st.created_by || st.dibuat_oleh_id || '',
    createdByName: st.createdByName || st.created_by_name || st.dibuat_oleh_nama || '',
    createdByAvatar: st.createdByAvatar || st.created_by_avatar || st.dibuat_oleh_foto || '',
    comments: mappedComments,
    createdAt: st.createdAt || st.created_at || '',
    updatedAt: st.updatedAt || st.updated_at || '',
  };
}

export type LocalHiddenChatMap = Record<string, number> | string[];

const LOCAL_HIDE_GRACE_MS = 15_000;

export function getActiveTaggedTeammateIds(
  topic: Pick<ChatTopic, 'taggedTeammateIds' | 'hiddenByIds'>,
  allUsers: UserIdentityLike[]
): string[] {
  const rawTagged = safeParseJsonArray(
    topic.taggedTeammateIds ??
      (topic as unknown as Record<string, unknown>).id_anggota_ditandai ??
      (topic as unknown as Record<string, unknown>).tagged_teammate_ids
  );
  const hiddenSet = new Set(
    safeParseJsonArray(
      topic.hiddenByIds ??
        (topic as unknown as Record<string, unknown>).hidden_by_ids ??
        (topic as unknown as Record<string, unknown>).dihapus_oleh_ids
    ).map((id) => String(id).trim())
  );

  if (hiddenSet.size === 0) return rawTagged;

  const hiddenIdentifiers = new Set<string>(Array.from(hiddenSet).map((id) => id.toLowerCase()));
  (allUsers || []).forEach((u) => {
    if (u?.id && hiddenSet.has(String(u.id).trim())) {
      getUserMatchIdentifiers(u).forEach((identifier) => hiddenIdentifiers.add(identifier));
    }
  });

  return rawTagged.filter((tag) => !hiddenIdentifiers.has(String(tag || '').trim().toLowerCase()));
}

export function resolveActiveTaggedUsers<T extends UserIdentityLike>(
  topic: Pick<ChatTopic, 'taggedTeammateIds' | 'hiddenByIds'>,
  allUsers: T[]
): T[] {
  const activeTags = getActiveTaggedTeammateIds(topic, allUsers);
  const hiddenSet = new Set(
    safeParseJsonArray(
      topic.hiddenByIds ??
        (topic as unknown as Record<string, unknown>).hidden_by_ids ??
        (topic as unknown as Record<string, unknown>).dihapus_oleh_ids
    ).map((id) => String(id).trim())
  );

  const result: T[] = [];
  const seen = new Set<string>();

  activeTags.forEach((uid) => {
    if (!uid) return;
    const cleanUid = String(uid).trim().toLowerCase();
    const matched = (allUsers || []).find(
      (user) =>
        (user.id && user.id.toLowerCase() === cleanUid) ||
        (user.name && user.name.toLowerCase().trim() === cleanUid) ||
        (user.email && user.email.toLowerCase().trim() === cleanUid)
    );
    if (!matched || !matched.name || matched.name.toLowerCase().includes('rekan tim')) return;
    if (hiddenSet.has(String(matched.id).trim())) return;

    const dedupeKey = matched.email ? matched.email.toLowerCase().trim() : matched.id;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    result.push(matched);
  });

  return result;
}

export function isUserActivelyTaggedInTopic(
  topic: Pick<ChatTopic, 'taggedTeammateIds' | 'hiddenByIds'>,
  targetUser: UserIdentityLike | null | undefined,
  allUsers: UserIdentityLike[]
): boolean {
  if (!targetUser?.id) return false;
  return resolveActiveTaggedUsers(topic, allUsers).some((u) => u.id === targetUser.id);
}

export function applyUserTagToggleToTopic(
  topic: ChatTopic,
  targetUser: UserIdentityLike,
  allUsers: UserIdentityLike[]
): { nextTopic: ChatTopic; added: boolean } {
  const rawTagged = safeParseJsonArray(
    topic.taggedTeammateIds ??
      (topic as unknown as Record<string, unknown>).id_anggota_ditandai ??
      (topic as unknown as Record<string, unknown>).tagged_teammate_ids
  );
  const currentHidden = safeParseJsonArray(
    topic.hiddenByIds ??
      (topic as unknown as Record<string, unknown>).hidden_by_ids ??
      (topic as unknown as Record<string, unknown>).dihapus_oleh_ids
  ).map((id) => String(id).trim());

  const targetIdSet = new Set(getUserMatchIdentifiers(targetUser));
  const currentlyActive = isUserActivelyTaggedInTopic(topic, targetUser, allUsers);

  let nextTagged: string[];
  let nextHidden: string[];

  if (currentlyActive) {
    nextTagged = rawTagged.filter(
      (tag) => !targetIdSet.has(String(tag || '').trim().toLowerCase())
    );
    nextHidden = currentHidden;
  } else {
    const cleanedExisting = rawTagged.filter(
      (tag) => !targetIdSet.has(String(tag || '').trim().toLowerCase())
    );
    const additions = [
      targetUser.id,
      ...(targetUser.email ? [targetUser.email] : []),
      ...(targetUser.name ? [targetUser.name] : []),
    ].filter(Boolean) as string[];
    nextTagged = Array.from(new Set([...cleanedExisting, ...additions]));
    nextHidden = currentHidden.filter((id) => id !== String(targetUser.id).trim());
  }

  return {
    added: !currentlyActive,
    nextTopic: {
      ...topic,
      taggedTeammateIds: nextTagged,
      hiddenByIds: nextHidden,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function mergeServerChatTopics(
  localTopics: ChatTopic[],
  serverTopics: any[],
  currentUserId?: string | null,
  localHidden: LocalHiddenChatMap = {},
  nowMs: number = Date.now()
): ChatTopic[] {
  const localById = new Map(localTopics.map((t) => [t.id, t]));
  const serverIds = new Set(serverTopics.map((st: any) => String(st.id)));
  const hiddenTimestampMap: Record<string, number> = Array.isArray(localHidden)
    ? Object.fromEntries(localHidden.map((id) => [String(id), nowMs]))
    : localHidden || {};

  const merged: ChatTopic[] = serverTopics.map((st) => {
    const mapped = mapServerChatTopic(st, localById.get(st.id));
    if (currentUserId && Object.prototype.hasOwnProperty.call(hiddenTimestampMap, mapped.id)) {
      const deletedAtMs = hiddenTimestampMap[mapped.id];
      const serverUpdatedMs = Date.parse(mapped.updatedAt || mapped.createdAt || '');
      const reinvitedAfterDelete =
        !Number.isNaN(serverUpdatedMs) &&
        serverUpdatedMs > deletedAtMs + 1000 &&
        !(mapped.hiddenByIds || []).includes(currentUserId);

      if (!reinvitedAfterDelete && nowMs - deletedAtMs < LOCAL_HIDE_GRACE_MS) {
        const nextHidden = Array.from(
          new Set([...(mapped.hiddenByIds || []), currentUserId])
        );
        return { ...mapped, hiddenByIds: nextHidden };
      }
    }
    return mapped;
  });

  // Preserve newly created local topics whose create request may still be in flight
  for (const localTopic of localTopics) {
    if (!serverIds.has(localTopic.id) && isRecentLocalTopic(localTopic, nowMs)) {
      merged.push(localTopic);
    }
  }

  merged.sort((a, b) => {
    const timeA = a.updatedAt || a.createdAt || '';
    const timeB = b.updatedAt || b.createdAt || '';
    if (timeA !== timeB) return timeB.localeCompare(timeA);
    return (b.id || '').localeCompare(a.id || '');
  });

  return merged;
}
