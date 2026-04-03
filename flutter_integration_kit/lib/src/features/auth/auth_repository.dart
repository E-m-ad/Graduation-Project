import 'package:cookie_jar/cookie_jar.dart';

import '../../core/http/api_client.dart';
import '../../core/http/api_endpoints.dart';
import '../../core/storage/session_store.dart';

class AuthRepository {
  AuthRepository({
    required ApiClient apiClient,
    required SessionStore sessionStore,
    required CookieJar cookieJar,
  })  : _apiClient = apiClient,
        _sessionStore = sessionStore,
        _cookieJar = cookieJar;

  final ApiClient _apiClient;
  final SessionStore _sessionStore;
  final CookieJar _cookieJar;

  Future<Map<String, dynamic>> register({
    required String name,
    required String email,
    required String password,
    required String confirmPassword,
  }) {
    return _apiClient.post(
      ApiEndpoints.authRegister,
      data: {
        'name': name,
        'email': email,
        'password': password,
        'confirmPassword': confirmPassword,
      },
    );
  }

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final response = await _apiClient.post(
      ApiEndpoints.authLogin,
      data: {
        'email': email,
        'password': password,
      },
    );

    final accessToken = response['accessToken'] as String?;
    if (accessToken != null && accessToken.isNotEmpty) {
      await _sessionStore.saveAccessToken(accessToken);
    }

    return response;
  }

  Future<Map<String, dynamic>> refreshAccessToken() async {
    final response = await _apiClient.post(ApiEndpoints.authRefreshToken);
    final accessToken = response['accessToken'] as String?;

    if (accessToken != null && accessToken.isNotEmpty) {
      await _sessionStore.saveAccessToken(accessToken);
    }

    return response;
  }

  Future<Map<String, dynamic>> forgotPassword(String email) {
    return _apiClient.post(
      ApiEndpoints.authForgotPassword,
      data: {
        'email': email,
      },
    );
  }

  Future<Map<String, dynamic>> resetPassword({
    required String token,
    required String password,
    required String confirmPassword,
  }) {
    return _apiClient.post(
      ApiEndpoints.authResetPassword,
      data: {
        'token': token,
        'password': password,
        'confirmPassword': confirmPassword,
      },
    );
  }

  Future<Map<String, dynamic>> logout() async {
    try {
      return await _apiClient.post(ApiEndpoints.authLogout);
    } finally {
      await clearLocalSession();
    }
  }

  Future<void> clearLocalSession() async {
    await _sessionStore.clear();
    await _cookieJar.deleteAll();
  }
}
