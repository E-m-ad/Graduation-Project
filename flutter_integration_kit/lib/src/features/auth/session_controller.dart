import 'package:flutter/foundation.dart';

import '../../config/app_dependencies.dart';
import '../../core/models/app_user.dart';
import '../../core/utils/json_utils.dart';

enum SessionStatus {
  booting,
  guest,
  authenticated,
}

class SessionController extends ChangeNotifier {
  SessionController({
    required AppDependencies dependencies,
  }) : _dependencies = dependencies;

  final AppDependencies _dependencies;

  SessionStatus _status = SessionStatus.booting;
  AppUser? _currentUser;
  bool _isBusy = false;

  SessionStatus get status => _status;
  AppUser? get currentUser => _currentUser;
  bool get isBusy => _isBusy;
  bool get isAuthenticated => _status == SessionStatus.authenticated;

  Future<void> bootstrap() async {
    _status = SessionStatus.booting;
    notifyListeners();

    try {
      final storedAccessToken =
          await _dependencies.sessionStore.readAccessToken();

      if (storedAccessToken != null && storedAccessToken.isNotEmpty) {
        await refreshProfile();
        return;
      }

      try {
        await _dependencies.auth.refreshAccessToken();
        await refreshProfile();
        return;
      } catch (_) {
        await _dependencies.auth.clearLocalSession();
      }
    } catch (_) {
      await _dependencies.auth.clearLocalSession();
    }

    _currentUser = null;
    _status = SessionStatus.guest;
    notifyListeners();
  }

  Future<String?> login({
    required String email,
    required String password,
  }) async {
    return _runBusy(() async {
      await _dependencies.auth.login(email: email, password: password);
      await refreshProfile();
      return null;
    });
  }

  Future<String?> register({
    required String name,
    required String email,
    required String password,
    required String confirmPassword,
  }) async {
    return _runBusy(() async {
      await _dependencies.auth.register(
        name: name,
        email: email,
        password: password,
        confirmPassword: confirmPassword,
      );

      await _dependencies.auth.login(email: email, password: password);
      await refreshProfile();
      return null;
    });
  }

  Future<String?> logout() async {
    return _runBusy(() async {
      await _dependencies.auth.logout();
      _currentUser = null;
      _status = SessionStatus.guest;
      notifyListeners();
      return null;
    });
  }

  Future<String?> refreshProfile() async {
    try {
      final response = await _dependencies.users.getMyProfile();
      final payload = asJsonMap(response['data']) ?? const <String, dynamic>{};
      _currentUser = AppUser.fromJson(payload);
      _status = SessionStatus.authenticated;
      notifyListeners();
      return null;
    } catch (error) {
      await _dependencies.auth.clearLocalSession();
      _currentUser = null;
      _status = SessionStatus.guest;
      notifyListeners();
      return error.toString();
    }
  }

  Future<String?> _runBusy(Future<String?> Function() action) async {
    _isBusy = true;
    notifyListeners();

    try {
      return await action();
    } catch (error) {
      return _extractMessage(error);
    } finally {
      _isBusy = false;
      notifyListeners();
    }
  }

  String _extractMessage(Object error) {
    return error.toString().replaceFirst('Exception: ', '');
  }
}
