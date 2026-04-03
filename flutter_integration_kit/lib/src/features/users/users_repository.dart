import 'package:dio/dio.dart';

import '../../core/http/api_client.dart';
import '../../core/http/api_endpoints.dart';

class UsersRepository {
  UsersRepository({
    required ApiClient apiClient,
  }) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> getMyProfile() {
    return _apiClient.get(
      ApiEndpoints.usersMe,
      requiresAuth: true,
    );
  }

  Future<Map<String, dynamic>> updateMyProfile({
    String? name,
    String? phone,
    String? city,
    String? address,
    String? bio,
  }) {
    return _apiClient.put(
      ApiEndpoints.usersMe,
      requiresAuth: true,
      data: {
        'name': name,
        'phone': phone,
        'city': city,
        'address': address,
        'bio': bio,
      },
    );
  }

  Future<Map<String, dynamic>> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmNewPassword,
  }) {
    return _apiClient.put(
      ApiEndpoints.usersChangePassword,
      requiresAuth: true,
      data: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
        'confirmNewPassword': confirmNewPassword,
      },
    );
  }

  Future<Map<String, dynamic>> uploadAvatar(String filePath) {
    final formData = FormData.fromMap({
      'avatar': MultipartFile.fromFileSync(filePath),
    });

    return _apiClient.postFormData(
      ApiEndpoints.usersUploadAvatar,
      data: formData,
      requiresAuth: true,
    );
  }

  Future<Map<String, dynamic>> getPublicProfile(String userId) {
    return _apiClient.get(ApiEndpoints.publicUser(userId));
  }

  Future<Map<String, dynamic>> getPublicUserProducts(String userId) {
    return _apiClient.get(ApiEndpoints.publicUserProducts(userId));
  }

  Future<Map<String, dynamic>> getPublicUserReviews(String userId) {
    return _apiClient.get(ApiEndpoints.publicUserReviews(userId));
  }
}
