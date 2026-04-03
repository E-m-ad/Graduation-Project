function buildNotificationCreateManyData(userIds, input) {
  const uniqueUserIds = [...new Set((userIds ?? []).filter(Boolean))];

  return uniqueUserIds.map((userId) => ({
    userId,
    type: input.type ?? "system",
    title: input.title,
    message: input.message,
    ...(input.rentalId ? { rentalId: input.rentalId } : {}),
    ...(input.data !== undefined ? { data: input.data } : {}),
  }));
}

export async function createNotificationsForUsers(tx, userIds, input) {
  const data = buildNotificationCreateManyData(userIds, input);

  if (!data.length) {
    return { count: 0 };
  }

  return tx.notification.createMany({
    data,
  });
}

export async function createAdminNotifications(tx, input) {
  const admins = await tx.user.findMany({
    where: {
      role: "admin",
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  return createNotificationsForUsers(
    tx,
    admins.map((admin) => admin.id),
    {
      ...input,
      type: input.type ?? "system",
    },
  );
}
