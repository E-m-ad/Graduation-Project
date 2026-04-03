import '../../core/http/api_client.dart';
import '../../core/http/api_endpoints.dart';

class NotificationsRepository {
  NotificationsRepository({
    required ApiClient apiClient,
  }) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> getNotifications({
    int? page,
    int? limit,
    bool? isRead,
    String? type,
  }) {
    return _apiClient.get(
      ApiEndpoints.notifications,
      requiresAuth: true,
      queryParameters: {
        'page': page,
        'limit': limit,
        'isRead': isRead,
        'type': type,
      },
    );
  }

  Future<Map<String, dynamic>> getUnreadCount() {
    return _apiClient.get(
      ApiEndpoints.notificationsUnreadCount,
      requiresAuth: true,
    );
  }

  Future<Map<String, dynamic>> markAsRead(String id) {
    return _apiClient.put(
      ApiEndpoints.notificationRead(id),
      requiresAuth: true,
    );
  }

  Future<Map<String, dynamic>> markAllAsRead() {
    return _apiClient.put(
      ApiEndpoints.notificationsReadAll,
      requiresAuth: true,
    );
  }
}
