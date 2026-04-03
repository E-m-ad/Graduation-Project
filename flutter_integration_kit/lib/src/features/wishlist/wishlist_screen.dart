import 'package:flutter/material.dart';

import '../../config/app_dependencies.dart';
import '../../core/utils/json_utils.dart';
import '../../core/widgets/app_state_views.dart';
import '../../core/widgets/product_card.dart';
import '../auth/session_controller.dart';
import '../products/product_details_screen.dart';

class WishlistScreen extends StatelessWidget {
  const WishlistScreen({
    super.key,
    required this.dependencies,
    required this.sessionController,
  });

  final AppDependencies dependencies;
  final SessionController sessionController;

  @override
  Widget build(BuildContext context) {
    if (!sessionController.isAuthenticated) {
      return const Scaffold(
        body: AppEmptyState(
          title: 'Save listings you love',
          message:
              'Sign in from the Profile tab to build your wishlist and come back to listings later.',
          icon: Icons.favorite_border,
        ),
      );
    }

    return _WishlistContent(
      dependencies: dependencies,
      sessionController: sessionController,
    );
  }
}

class _WishlistContent extends StatefulWidget {
  const _WishlistContent({
    required this.dependencies,
    required this.sessionController,
  });

  final AppDependencies dependencies;
  final SessionController sessionController;

  @override
  State<_WishlistContent> createState() => _WishlistContentState();
}

class _WishlistContentState extends State<_WishlistContent> {
  bool _isLoading = true;
  String? _error;
  List<JsonMap> _wishlists = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await widget.dependencies.wishlist.getMyWishlist(limit: 50);
      setState(() {
        _wishlists = asJsonMap(response['data'])?.jsonList('wishlists') ?? const [];
        _isLoading = false;
      });
    } catch (error) {
      setState(() {
        _error = error.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Saved listings')),
      body: _isLoading
          ? const AppLoadingView(label: 'Loading wishlist...')
          : _error != null
              ? AppErrorState(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _wishlists.isEmpty
                      ? ListView(
                          children: const [
                            SizedBox(
                              height: 520,
                              child: AppEmptyState(
                                title: 'Nothing saved yet',
                                message:
                                    'Tap the heart on any listing to keep it here for later.',
                                icon: Icons.favorite_outline,
                              ),
                            ),
                          ],
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                          itemCount: _wishlists.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 16),
                          itemBuilder: (context, index) {
                            final entry = _wishlists[index];
                            final product =
                                entry.json('product') ?? <String, dynamic>{};

                            return ProductCard(
                              product: product,
                              onTap: () => _openProduct(product.string('id')),
                              trailing: IconButton(
                                onPressed: () => _remove(product.string('id')),
                                icon: const Icon(Icons.favorite, color: Colors.red),
                              ),
                            );
                          },
                        ),
                ),
    );
  }

  Future<void> _remove(String productId) async {
    try {
      await widget.dependencies.wishlist.removeFromWishlist(productId);
      setState(() {
        _wishlists = _wishlists
            .where((entry) => entry.json('product')?.string('id') != productId)
            .toList(growable: false);
      });
      _showSnack('Removed from wishlist.');
    } catch (error) {
      _showSnack(error.toString());
    }
  }

  Future<void> _openProduct(String productId) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ProductDetailsScreen(
          dependencies: widget.dependencies,
          sessionController: widget.sessionController,
          productId: productId,
        ),
      ),
    );
    await _load();
  }

  void _showSnack(String message) {
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }
}
