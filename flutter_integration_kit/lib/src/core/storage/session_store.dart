import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SessionStore {
  SessionStore({
    FlutterSecureStorage? secureStorage,
  }) : _secureStorage = secureStorage ?? const FlutterSecureStorage();

  static const _accessTokenKey = 'access_token';

  final FlutterSecureStorage _secureStorage;

  Future<void> saveAccessToken(String accessToken) {
    return _secureStorage.write(
      key: _accessTokenKey,
      value: accessToken,
    );
  }

  Future<String?> readAccessToken() {
    return _secureStorage.read(key: _accessTokenKey);
  }

  Future<void> clear() {
    return _secureStorage.delete(key: _accessTokenKey);
  }
}
