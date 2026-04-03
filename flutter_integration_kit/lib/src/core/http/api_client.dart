import 'dart:async';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';

import '../../config/app_config.dart';
import '../storage/session_store.dart';
import 'api_endpoints.dart';
import 'api_exception.dart';

class ApiClient {
  ApiClient({
    required this.config,
    required this.sessionStore,
    required this.cookieJar,
  }) : _dio = Dio(
          BaseOptions(
            baseUrl: config.baseUrl,
            connectTimeout: config.connectTimeout,
            receiveTimeout: config.receiveTimeout,
            sendTimeout: config.sendTimeout,
            headers: const {
              'Accept': 'application/json',
            },
          ),
        ) {
    _dio.interceptors.add(CookieManager(cookieJar));
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final requiresAuth = options.extra['requiresAuth'] == true;
          if (requiresAuth) {
            final accessToken = await sessionStore.readAccessToken();
            if (accessToken != null && accessToken.isNotEmpty) {
              options.headers['Authorization'] = 'Bearer $accessToken';
            }
          }

          handler.next(options);
        },
        onError: (error, handler) async {
          final request = error.requestOptions;
          final requiresAuth = request.extra['requiresAuth'] == true;
          final skipRefresh = request.extra['skipRefresh'] == true;
          final retryable = request.extra['retryable'] != false;
          final isUnauthorized = error.response?.statusCode == 401;
          final isRefreshCall = request.path == ApiEndpoints.authRefreshToken;

          if (!requiresAuth ||
              !isUnauthorized ||
              skipRefresh ||
              isRefreshCall ||
              !retryable) {
            handler.next(_mapDioError(error));
            return;
          }

          final refreshedToken = await _refreshAccessToken();
          if (refreshedToken == null) {
            handler.next(_mapDioError(error));
            return;
          }

          try {
            request.headers['Authorization'] = 'Bearer $refreshedToken';
            final clonedResponse = await _dio.fetch<dynamic>(request);
            handler.resolve(clonedResponse);
          } on DioException catch (retryError) {
            handler.next(_mapDioError(retryError));
          }
        },
      ),
    );

    if (config.enableNetworkLogs) {
      _dio.interceptors.add(
        LogInterceptor(
          requestBody: true,
          responseBody: true,
        ),
      );
    }
  }

  final AppConfig config;
  final SessionStore sessionStore;
  final PersistCookieJar cookieJar;
  final Dio _dio;
  Completer<String?>? _refreshCompleter;

  Future<Map<String, dynamic>> fetchOpenApiDocument() {
    return get(
      ApiEndpoints.docsOpenApi,
      requiresAuth: false,
    );
  }

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, dynamic>? queryParameters,
    bool requiresAuth = false,
    bool retryable = true,
  }) async {
    final response = await _dio.get<dynamic>(
      path,
      queryParameters: _cleanQueryParameters(queryParameters),
      options: Options(
        extra: {
          'requiresAuth': requiresAuth,
          'retryable': retryable,
        },
      ),
    );

    return _readMap(response.data);
  }

  Future<Map<String, dynamic>> post(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    bool requiresAuth = false,
    bool retryable = true,
  }) async {
    final response = await _dio.post<dynamic>(
      path,
      data: _cleanBody(data),
      queryParameters: _cleanQueryParameters(queryParameters),
      options: Options(
        extra: {
          'requiresAuth': requiresAuth,
          'retryable': retryable,
        },
      ),
    );

    return _readMap(response.data);
  }

  Future<Map<String, dynamic>> put(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    bool requiresAuth = false,
    bool retryable = true,
  }) async {
    final response = await _dio.put<dynamic>(
      path,
      data: _cleanBody(data),
      queryParameters: _cleanQueryParameters(queryParameters),
      options: Options(
        extra: {
          'requiresAuth': requiresAuth,
          'retryable': retryable,
        },
      ),
    );

    return _readMap(response.data);
  }

  Future<Map<String, dynamic>> delete(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    bool requiresAuth = false,
    bool retryable = true,
  }) async {
    final response = await _dio.delete<dynamic>(
      path,
      data: _cleanBody(data),
      queryParameters: _cleanQueryParameters(queryParameters),
      options: Options(
        extra: {
          'requiresAuth': requiresAuth,
          'retryable': retryable,
        },
      ),
    );

    return _readMap(response.data);
  }

  Future<Map<String, dynamic>> postFormData(
    String path, {
    required FormData data,
    bool requiresAuth = false,
  }) {
    return post(
      path,
      data: data,
      requiresAuth: requiresAuth,
      retryable: false,
    );
  }

  Future<String?> _refreshAccessToken() async {
    if (_refreshCompleter != null) {
      return _refreshCompleter!.future;
    }

    final completer = Completer<String?>();
    _refreshCompleter = completer;

    () async {
      try {
        final response = await _dio.post<dynamic>(
          ApiEndpoints.authRefreshToken,
          options: Options(
            extra: const {
              'requiresAuth': false,
              'skipRefresh': true,
              'retryable': false,
            },
          ),
        );
        final payload = _readMap(response.data);
        final refreshedToken = payload['accessToken'] as String?;

        if (refreshedToken == null || refreshedToken.isEmpty) {
          await sessionStore.clear();
          completer.complete(null);
          return;
        }

        await sessionStore.saveAccessToken(refreshedToken);
        completer.complete(refreshedToken);
      } on DioException {
        await sessionStore.clear();
        completer.complete(null);
      } finally {
        _refreshCompleter = null;
      }
    }();

    return completer.future;
  }

  DioException _mapDioError(DioException error) {
    final responsePayload = error.response?.data;
    final payload = responsePayload is Map<String, dynamic>
        ? responsePayload
        : <String, dynamic>{};
    final message = payload['message'] as String? ??
        (payload['error'] is Map<String, dynamic>
            ? payload['error']['message'] as String?
            : null) ??
        error.message ??
        'Unexpected network error';

    return DioException(
      requestOptions: error.requestOptions,
      response: error.response,
      type: error.type,
      error: ApiException(
        message: message,
        statusCode: error.response?.statusCode,
        payload: payload,
      ),
      message: message,
    );
  }

  Map<String, dynamic> _cleanQueryParameters(Map<String, dynamic>? source) {
    if (source == null || source.isEmpty) {
      return const {};
    }

    final cleaned = <String, dynamic>{};
    source.forEach((key, value) {
      if (value != null) {
        cleaned[key] = value;
      }
    });
    return cleaned;
  }

  Object? _cleanBody(Object? data) {
    if (data is Map<String, dynamic>) {
      final cleaned = <String, dynamic>{};
      data.forEach((key, value) {
        if (value != null) {
          cleaned[key] = value;
        }
      });
      return cleaned;
    }

    return data;
  }

  Map<String, dynamic> _readMap(Object? raw) {
    if (raw is Map<String, dynamic>) {
      return raw;
    }

    throw ApiException(message: 'Expected a JSON object response');
  }
}
