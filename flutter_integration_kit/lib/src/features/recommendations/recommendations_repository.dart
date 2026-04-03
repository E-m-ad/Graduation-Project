import '../../core/http/api_client.dart';
import '../../core/http/api_endpoints.dart';

class RecommendationsRepository {
  RecommendationsRepository({
    required ApiClient apiClient,
  }) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> getRecommendations({
    int? page,
    int? limit,
  }) {
    return _apiClient.get(
      ApiEndpoints.recommendations,
      requiresAuth: true,
      queryParameters: {
        'page': page,
        'limit': limit,
      },
    );
  }

  Future<Map<String, dynamic>> getSimilarProducts({
    required String productId,
    int? page,
    int? limit,
  }) {
    return _apiClient.get(
      ApiEndpoints.similarRecommendations(productId),
      queryParameters: {
        'page': page,
        'limit': limit,
      },
    );
  }
}
