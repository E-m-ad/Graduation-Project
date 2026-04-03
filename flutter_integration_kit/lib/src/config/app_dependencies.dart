import 'package:flutter/foundation.dart';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../core/http/api_client.dart';
import '../core/storage/session_store.dart';
import '../features/admin/admin_repository.dart';
import '../features/auth/auth_repository.dart';
import '../features/behavior/behavior_repository.dart';
import '../features/categories/categories_repository.dart';
import '../features/notifications/notifications_repository.dart';
import '../features/products/products_repository.dart';
import '../features/rentals/rentals_repository.dart';
import '../features/recommendations/recommendations_repository.dart';
import '../features/reviews/reviews_repository.dart';
import '../features/users/users_repository.dart';
import '../features/wishlist/wishlist_repository.dart';
import 'app_config.dart';

class AppDependencies {
  AppDependencies._({
    required this.config,
    required this.sessionStore,
    required this.apiClient,
    required this.auth,
    required this.users,
    required this.categories,
    required this.products,
    required this.rentals,
    required this.reviews,
    required this.wishlist,
    required this.recommendations,
    required this.behavior,
    required this.notifications,
    required this.admin,
  });

  final AppConfig config;
  final SessionStore sessionStore;
  final ApiClient apiClient;
  final AuthRepository auth;
  final UsersRepository users;
  final CategoriesRepository categories;
  final ProductsRepository products;
  final RentalsRepository rentals;
  final ReviewsRepository reviews;
  final WishlistRepository wishlist;
  final RecommendationsRepository recommendations;
  final BehaviorRepository behavior;
  final NotificationsRepository notifications;
  final AdminRepository admin;

  static Future<AppDependencies> bootstrap({
    AppConfig? config,
  }) async {
    final resolvedConfig = config ?? AppConfig.fromEnvironment();
    final sessionStore = SessionStore();
    final CookieJar cookieJar;
    if (kIsWeb) {
      cookieJar = CookieJar();
    } else {
      final documentsDirectory = await getApplicationDocumentsDirectory();
      cookieJar = PersistCookieJar(
        ignoreExpires: false,
        storage: FileStorage(p.join(documentsDirectory.path, 'cookies')),
      );
    }
    final apiClient = ApiClient(
      config: resolvedConfig,
      sessionStore: sessionStore,
      cookieJar: cookieJar,
    );

    return AppDependencies._(
      config: resolvedConfig,
      sessionStore: sessionStore,
      apiClient: apiClient,
      auth: AuthRepository(
        apiClient: apiClient,
        sessionStore: sessionStore,
        cookieJar: cookieJar,
      ),
      users: UsersRepository(apiClient: apiClient),
      categories: CategoriesRepository(apiClient: apiClient),
      products: ProductsRepository(apiClient: apiClient),
      rentals: RentalsRepository(apiClient: apiClient),
      reviews: ReviewsRepository(apiClient: apiClient),
      wishlist: WishlistRepository(apiClient: apiClient),
      recommendations: RecommendationsRepository(apiClient: apiClient),
      behavior: BehaviorRepository(apiClient: apiClient),
      notifications: NotificationsRepository(apiClient: apiClient),
      admin: AdminRepository(apiClient: apiClient),
    );
  }
}
