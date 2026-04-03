import 'package:flutter/material.dart';

import '../../config/app_dependencies.dart';
import '../../core/utils/json_utils.dart';
import '../../core/widgets/app_state_views.dart';
import '../../core/widgets/product_card.dart';
import '../../core/widgets/section_header.dart';
import '../auth/session_controller.dart';
import '../products/product_details_screen.dart';

class ExploreScreen extends StatefulWidget {
  const ExploreScreen({
    super.key,
    required this.dependencies,
    required this.sessionController,
  });

  final AppDependencies dependencies;
  final SessionController sessionController;

  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> {
  final _searchController = TextEditingController();

  bool _isLoading = true;
  String? _error;
  List<JsonMap> _categories = const [];
  List<JsonMap> _products = const [];
  List<JsonMap> _recommendations = const [];
  String? _selectedCategoryId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final categoriesResponse = await widget.dependencies.categories.listCategories();
      final productsResponse = await widget.dependencies.products.listProducts(
        limit: 12,
        search: _searchController.text.trim().isEmpty
            ? null
            : _searchController.text.trim(),
        categoryId: _selectedCategoryId,
      );

      List<JsonMap> recommendations = const [];
      if (widget.sessionController.isAuthenticated) {
        try {
          final recommendationsResponse =
              await widget.dependencies.recommendations.getRecommendations(limit: 8);
          recommendations = asJsonMap(recommendationsResponse['data'])
                  ?.jsonList('products') ??
              const [];
        } catch (_) {
          recommendations = const [];
        }
      }

      setState(() {
        _categories = asJsonMap(categoriesResponse['data'])?.jsonList('categories') ??
            const [];
        _products =
            asJsonMap(productsResponse['data'])?.jsonList('products') ?? const [];
        _recommendations = recommendations;
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
    if (_isLoading) {
      return const AppLoadingView(label: 'Loading explore feed...');
    }

    if (_error != null) {
      return AppErrorState(
        message: _error!,
        onRetry: _load,
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
        children: [
          _ExploreHero(
            isAuthenticated: widget.sessionController.isAuthenticated,
            userName: widget.sessionController.currentUser?.name,
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _searchController,
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.search),
              hintText: 'Search by title, description, or city',
              suffixIcon: IconButton(
                onPressed: _load,
                icon: const Icon(Icons.arrow_forward),
              ),
            ),
            onSubmitted: (_) => _load(),
          ),
          const SizedBox(height: 18),
          SectionHeader(
            title: 'Categories',
            subtitle: 'Jump into the type of item you need today.',
            actionLabel: _selectedCategoryId == null ? null : 'Clear',
            onAction: () {
              setState(() {
                _selectedCategoryId = null;
              });
              _load();
            },
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 44,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _categories.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (context, index) {
                final category = _categories[index];
                final isSelected = _selectedCategoryId == category.string('id');

                return ChoiceChip(
                  label: Text(category.string('name', fallback: 'Category')),
                  selected: isSelected,
                  onSelected: (_) {
                    setState(() {
                      _selectedCategoryId = isSelected ? null : category.string('id');
                    });
                    _load();
                  },
                );
              },
            ),
          ),
          if (widget.sessionController.isAuthenticated) ...[
            const SizedBox(height: 24),
            SectionHeader(
              title: 'For you',
              subtitle: 'Recommendations based on your activity.',
            ),
            const SizedBox(height: 12),
            if (_recommendations.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(18),
                  child: Text(
                    'Use the app a bit more and your personalized recommendations will appear here.',
                  ),
                ),
              )
            else
              SizedBox(
                height: 344,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _recommendations.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 14),
                  itemBuilder: (context, index) {
                    final product = _recommendations[index];

                    return SizedBox(
                      width: 290,
                      child: ProductCard(
                        product: product,
                        onTap: () => _openProduct(product),
                      ),
                    );
                  },
                ),
              ),
          ] else ...[
            const SizedBox(height: 24),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 22,
                      backgroundColor:
                          Theme.of(context).colorScheme.primary.withOpacity(0.12),
                      child: Icon(
                        Icons.auto_awesome_outlined,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Text(
                        'Sign in from the Profile tab to unlock personalized recommendations, rentals, and notifications.',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 24),
          SectionHeader(
            title: 'Browse listings',
            subtitle: '${_products.length} items matching your current filters.',
          ),
          const SizedBox(height: 12),
          if (_products.isEmpty)
            const AppEmptyState(
              title: 'No listings found',
              message:
                  'Try a different search term or clear the selected category filter.',
              icon: Icons.search_off,
            )
          else
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 1,
                mainAxisExtent: 380,
                crossAxisSpacing: 16,
                mainAxisSpacing: 16,
              ),
              itemCount: _products.length,
              itemBuilder: (context, index) {
                final product = _products[index];
                return ProductCard(
                  product: product,
                  onTap: () => _openProduct(product),
                );
              },
            ),
        ],
      ),
    );
  }

  Future<void> _openProduct(JsonMap product) async {
    if (widget.sessionController.isAuthenticated) {
      try {
        await widget.dependencies.behavior.trackAction(
          actionType: 'view',
          productId: product.string('id'),
          categoryId: product.nullableString('categoryId') ??
              product.json('category')?.nullableString('id'),
        );
      } catch (_) {
        // Silent analytics failure.
      }
    }

    if (!mounted) {
      return;
    }

    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ProductDetailsScreen(
          dependencies: widget.dependencies,
          sessionController: widget.sessionController,
          productId: product.string('id'),
        ),
      ),
    );
  }
}

class _ExploreHero extends StatelessWidget {
  const _ExploreHero({
    required this.isAuthenticated,
    required this.userName,
  });

  final bool isAuthenticated;
  final String? userName;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFFAEAD7),
            Color(0xFFD9EDE6),
          ],
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isAuthenticated
                      ? 'Welcome back, ${userName ?? 'there'}'
                      : 'Rent smarter, not harder',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Discover trusted listings, compare flexible pricing, and move from browsing to booking in a few taps.',
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: Colors.black.withOpacity(0.68),
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            width: 78,
            height: 78,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(22),
            ),
            child: const Icon(
              Icons.travel_explore_outlined,
              size: 36,
            ),
          ),
        ],
      ),
    );
  }
}
