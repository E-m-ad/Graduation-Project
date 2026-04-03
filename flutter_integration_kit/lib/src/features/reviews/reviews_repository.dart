import '../../core/http/api_client.dart';
import '../../core/http/api_endpoints.dart';

class ReviewsRepository {
  ReviewsRepository({
    required ApiClient apiClient,
  }) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> createReview({
    required String rentalId,
    required int rating,
    String? comment,
  }) {
    return _apiClient.post(
      ApiEndpoints.reviews,
      requiresAuth: true,
      data: {
        'rentalId': rentalId,
        'rating': rating,
        'comment': comment,
      },
    );
  }

  Future<Map<String, dynamic>> getProductReviews({
    required String productId,
    int? page,
    int? limit,
  }) {
    return _apiClient.get(
      ApiEndpoints.reviewsByProduct(productId),
      queryParameters: {
        'page': page,
        'limit': limit,
      },
    );
  }

  Future<Map<String, dynamic>> updateReview({
    required String id,
    int? rating,
    String? comment,
  }) {
    return _apiClient.put(
      ApiEndpoints.reviewById(id),
      requiresAuth: true,
      data: {
        'rating': rating,
        'comment': comment,
      },
    );
  }

  Future<Map<String, dynamic>> replyToReview({
    required String id,
    required String ownerReply,
  }) {
    return _apiClient.put(
      ApiEndpoints.reviewReply(id),
      requiresAuth: true,
      data: {
        'ownerReply': ownerReply,
      },
    );
  }

  Future<Map<String, dynamic>> deleteReview(String id) {
    return _apiClient.delete(
      ApiEndpoints.reviewById(id),
      requiresAuth: true,
    );
  }
}
