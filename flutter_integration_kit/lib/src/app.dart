import 'package:flutter/material.dart';

import 'config/app_dependencies.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/session_controller.dart';
import 'features/home/explore_screen.dart';
import 'features/notifications/notifications_screen.dart';
import 'features/products/create_listing_screen.dart';
import 'features/rentals/rentals_screen.dart';
import 'features/users/profile_screen.dart';
import 'features/wishlist/wishlist_screen.dart';

class IntegrationStarterApp extends StatefulWidget {
  const IntegrationStarterApp({
    super.key,
    required this.dependencies,
  });

  final AppDependencies dependencies;

  @override
  State<IntegrationStarterApp> createState() => _IntegrationStarterAppState();
}

class _IntegrationStarterAppState extends State<IntegrationStarterApp> {
  late final SessionController _sessionController;

  @override
  void initState() {
    super.initState();
    _sessionController = SessionController(dependencies: widget.dependencies)
      ..bootstrap();
  }

  @override
  void dispose() {
    _sessionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _sessionController,
      builder: (context, _) {
        return MaterialApp(
          debugShowCheckedModeBanner: false,
          title: 'AI Rent',
          theme: AppTheme.light(),
          home: _sessionController.status == SessionStatus.booting
              ? const _AppBootScreen()
              : _AppShell(
                  dependencies: widget.dependencies,
                  sessionController: _sessionController,
                ),
        );
      },
    );
  }
}

class _AppBootScreen extends StatelessWidget {
  const _AppBootScreen();

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFFF9F3E6),
              Color(0xFFE7F0EB),
            ],
          ),
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 92,
                height: 92,
                decoration: BoxDecoration(
                  color: const Color(0xFF145C59),
                  borderRadius: BorderRadius.circular(28),
                ),
                child: const Icon(
                  Icons.inventory_2_outlined,
                  color: Colors.white,
                  size: 42,
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'AI Rent',
                style: textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Find what you need. Rent what you own.',
                style: textTheme.bodyLarge?.copyWith(
                  color: Colors.black.withOpacity(0.65),
                ),
              ),
              const SizedBox(height: 24),
              const SizedBox(
                width: 30,
                height: 30,
                child: CircularProgressIndicator(strokeWidth: 3),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AppShell extends StatefulWidget {
  const _AppShell({
    required this.dependencies,
    required this.sessionController,
  });

  final AppDependencies dependencies;
  final SessionController sessionController;

  @override
  State<_AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<_AppShell> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final session = widget.sessionController;

    final screens = [
      ExploreScreen(
        key: ValueKey('explore-${session.currentUser?.id ?? 'guest'}'),
        dependencies: widget.dependencies,
        sessionController: session,
      ),
      WishlistScreen(
        key: ValueKey('wishlist-${session.currentUser?.id ?? 'guest'}'),
        dependencies: widget.dependencies,
        sessionController: session,
      ),
      RentalsScreen(
        key: ValueKey('rentals-${session.currentUser?.id ?? 'guest'}'),
        dependencies: widget.dependencies,
        sessionController: session,
      ),
      NotificationsScreen(
        key: ValueKey('notifications-${session.currentUser?.id ?? 'guest'}'),
        dependencies: widget.dependencies,
        sessionController: session,
      ),
      ProfileScreen(
        key: ValueKey('profile-${session.currentUser?.id ?? 'guest'}'),
        dependencies: widget.dependencies,
        sessionController: session,
      ),
    ];

    return Scaffold(
      body: SafeArea(
        child: IndexedStack(
          index: _currentIndex,
          children: screens,
        ),
      ),
      floatingActionButton: session.isAuthenticated
          ? FloatingActionButton.extended(
              onPressed: _openCreateListing,
              icon: const Icon(Icons.add_business_outlined),
              label: const Text('New listing'),
            )
          : null,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.explore_outlined),
            selectedIcon: Icon(Icons.explore),
            label: 'Explore',
          ),
          NavigationDestination(
            icon: Icon(Icons.favorite_border),
            selectedIcon: Icon(Icons.favorite),
            label: 'Saved',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: 'Rentals',
          ),
          NavigationDestination(
            icon: Icon(Icons.notifications_none_outlined),
            selectedIcon: Icon(Icons.notifications),
            label: 'Inbox',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }

  Future<void> _openCreateListing() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => CreateListingScreen(
          dependencies: widget.dependencies,
          sessionController: widget.sessionController,
        ),
      ),
    );

    if (created == true && mounted) {
      await widget.sessionController.refreshProfile();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Listing submitted successfully.')),
      );
    }
  }
}
