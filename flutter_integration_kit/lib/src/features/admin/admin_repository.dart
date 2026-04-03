import '../../core/http/api_client.dart';
import '../../core/http/api_endpoints.dart';

class AdminRepository {
  AdminRepository({
    required ApiClient apiClient,
  }) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> getDashboard() {
    return _apiClient.get(
      ApiEndpoints.adminDashboard,
      requiresAuth: true,
    );
  }

  Future<Map<String, dynamic>> getUsers({
    int? page,
    int? limit,
    String? search,
    String? role,
    bool? isActive,
  }) {
    return _apiClient.get(
      ApiEndpoints.adminUsers,
      requiresAuth: true,
      queryParameters: {
        'page': page,
        'limit': limit,
        'search': search,
        'role': role,
        'isActive': isActive,
      },
    );
  }

  Future<Map<String, dynamic>> updateUserStatus({
    required String userId,
    bool? isActive,
    String? status,
    String? reason,
  }) {
    return _apiClient.put(
      ApiEndpoints.adminUserStatus(userId),
      requiresAuth: true,
      data: {
        'isActive': isActive,
        'status': status,
        'reason': reason,
      },
    );
  }

  Future<Map<String, dynamic>> getProducts({
    int? page,
    int? limit,
    String? search,
    String? status,
    bool? isApproved,
    String? ownerId,
    String? categoryId,
    String? city,
  }) {
    return _apiClient.get(
      ApiEndpoints.adminProducts,
      requiresAuth: true,
      queryParameters: {
        'page': page,
        'limit': limit,
        'search': search,
        'status': status,
        'isApproved': isApproved,
        'ownerId': ownerId,
        'categoryId': categoryId,
        'city': city,
      },
    );
  }

  Future<Map<String, dynamic>> approveProduct({
    required String productId,
    String? reason,
  }) {
    return _apiClient.put(
      ApiEndpoints.adminProductApprove(productId),
      requiresAuth: true,
      data: {
        'reason': reason,
      },
    );
  }

  Future<Map<String, dynamic>> rejectProduct({
    required String productId,
    String? reason,
  }) {
    return _apiClient.put(
      ApiEndpoints.adminProductReject(productId),
      requiresAuth: true,
      data: {
        'reason': reason,
      },
    );
  }

  Future<Map<String, dynamic>> getRentals({
    int? page,
    int? limit,
    String? search,
    String? status,
    String? ownerId,
    String? renterId,
    String? productId,
  }) {
    return _apiClient.get(
      ApiEndpoints.adminRentals,
      requiresAuth: true,
      queryParameters: {
        'page': page,
        'limit': limit,
        'search': search,
        'status': status,
        'ownerId': ownerId,
        'renterId': renterId,
        'productId': productId,
      },
    );
  }

  Future<Map<String, dynamic>> getReports({
    int? days,
    int? months,
  }) {
    return _apiClient.get(
      ApiEndpoints.adminReports,
      requiresAuth: true,
      queryParameters: {
        'days': days,
        'months': months,
      },
    );
  }
}
