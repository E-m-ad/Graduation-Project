import '../../core/http/api_client.dart';
import '../../core/http/api_endpoints.dart';

class BehaviorRepository {
  BehaviorRepository({
    required ApiClient apiClient,
  }) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> trackAction({
    required String actionType,
    String? productId,
    String? categoryId,
    String? searchQuery,
    String? sessionId,
    String? deviceInfo,
    Map<String, dynamic>? metadata,
  }) {
    return _apiClient.post(
      ApiEndpoints.behaviorTrack,
      requiresAuth: true,
      data: {
        'actionType': actionType,
        'productId': productId,
        'categoryId': categoryId,
        'searchQuery': searchQuery,
        'sessionId': sessionId,
        'deviceInfo': deviceInfo,
        'metadata': metadata,
      },
    );
  }
}
