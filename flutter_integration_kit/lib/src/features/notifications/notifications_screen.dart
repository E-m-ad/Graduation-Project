import 'package:flutter/material.dart';

import '../../config/app_dependencies.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/json_utils.dart';
import '../../core/widgets/app_state_views.dart';
import '../../core/widgets/status_chip.dart';
import '../auth/session_controller.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({
    super.key,
    required this.dependencies,
    required this.sessionController,
  });

  final AppDependencies dependencies;
  final SessionController sessionController;

  @override
  Widget build(BuildContext context) {
    if (!sessionController.isAuthenticated) {
      return const Scaffold(
        body: AppEmptyState(
          title: 'Stay in the loop',
          message:
              'Sign in to view rental updates, approvals, rejections, and system notifications.',
          icon: Icons.notifications_none_outlined,
        ),
      );
    }

    return _NotificationsContent(dependencies: dependencies);
  }
}

class _NotificationsContent extends StatefulWidget {
  const _NotificationsContent({
    required this.dependencies,
  });

  final AppDependencies dependencies;

  @override
  State<_NotificationsContent> createState() => _NotificationsContentState();
}

class _NotificationsContentState extends State<_NotificationsContent> {
  bool _isLoading = true;
  String? _error;
  List<JsonMap> _notifications = const [];
  int _unreadCount = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await widget.dependencies.notifications.getNotifications(
        limit: 50,
      );
      final data = asJsonMap(response['data']) ?? <String, dynamic>{};

      setState(() {
        _notifications = data.jsonList('notifications');
        _unreadCount = data.intValue('unreadCount') ?? 0;
        _isLoading = false;
      });
    } catch (error) {
      setState(() {
        _error = error.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (_unreadCount > 0)
            TextButton(
              onPressed: _markAllRead,
              child: const Text('Mark all read'),
            ),
        ],
      ),
      body: _isLoading
          ? const AppLoadingView(label: 'Loading notifications...')
          : _error != null
              ? AppErrorState(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _notifications.isEmpty
                      ? ListView(
                          children: const [
                            SizedBox(
                              height: 520,
                              child: AppEmptyState(
                                title: 'No notifications yet',
                                message:
                                    'Your rental activity and system updates will appear here.',
                                icon: Icons.notifications_off_outlined,
                              ),
                            ),
                          ],
                        )
                      : ListView(
                          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                          children: [
                            Card(
                              child: Padding(
                                padding: const EdgeInsets.all(18),
                                child: Row(
                                  children: [
                                    CircleAvatar(
                                      radius: 24,
                                      backgroundColor: Theme.of(context)
                                          .colorScheme
                                          .primary
                                          .withOpacity(0.12),
                                      child: Icon(
                                        Icons.notifications_active_outlined,
                                        color: Theme.of(context).colorScheme.primary,
                                      ),
                                    ),
                                    const SizedBox(width: 14),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            'Unread updates',
                                            style: Theme.of(context)
                                                .textTheme
                                                .titleMedium
                                                ?.copyWith(fontWeight: FontWeight.w800),
                                          ),
                                          const SizedBox(height: 4),
                                          Text('$_unreadCount unread notification(s)'),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),
                            ..._notifications.map(_buildNotificationCard),
                          ],
                        ),
                ),
    );
  }

  Widget _buildNotificationCard(JsonMap notification) {
    final isRead = notification.boolValue('isRead');
    final createdAt = notification.dateTime('createdAt');

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(24),
          onTap: () => isRead ? null : _markRead(notification.string('id')),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        notification.string('title', fallback: 'Notification'),
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                    ),
                    StatusChip(
                      label: isRead ? 'Read' : 'New',
                      color: isRead
                          ? Colors.grey
                          : Theme.of(context).colorScheme.primary,
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(notification.string('message')),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Icon(
                      Icons.schedule_outlined,
                      size: 16,
                      color: Colors.black.withOpacity(0.55),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      AppFormatters.dateTime(createdAt),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Colors.black.withOpacity(0.6),
                          ),
                    ),
                    if (!isRead) ...[
                      const Spacer(),
                      TextButton(
                        onPressed: () => _markRead(notification.string('id')),
                        child: const Text('Mark read'),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _markRead(String id) async {
    try {
      await widget.dependencies.notifications.markAsRead(id);
      await _load();
    } catch (error) {
      _showSnack(error.toString());
    }
  }

  Future<void> _markAllRead() async {
    try {
      await widget.dependencies.notifications.markAllAsRead();
      await _load();
    } catch (error) {
      _showSnack(error.toString());
    }
  }

  void _showSnack(String message) {
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }
}
