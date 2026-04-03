import 'package:flutter/material.dart';

import '../../config/app_dependencies.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/json_utils.dart';
import '../../core/widgets/app_state_views.dart';
import '../../core/widgets/product_card.dart';
import '../auth/session_controller.dart';
import 'create_listing_screen.dart';

class OwnerListingsScreen extends StatefulWidget {
  const OwnerListingsScreen({
    super.key,
    required this.dependencies,
    required this.sessionController,
  });

  final AppDependencies dependencies;
  final SessionController sessionController;

  @override
  State<OwnerListingsScreen> createState() => _OwnerListingsScreenState();
}

class _OwnerListingsScreenState extends State<OwnerListingsScreen> {
  bool _isLoading = true;
  String? _error;
  List<JsonMap> _products = const [];

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
      final response = await widget.dependencies.products.listMyListings(limit: 50);
      setState(() {
        _products = asJsonMap(response['data'])?.jsonList('products') ?? const [];
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
      appBar: AppBar(
        title: const Text('My listings'),
        actions: [
          IconButton(
            onPressed: _createListing,
            icon: const Icon(Icons.add_business_outlined),
          ),
        ],
      ),
      body: _isLoading
          ? const AppLoadingView(label: 'Loading listings...')
          : _error != null
              ? AppErrorState(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _products.isEmpty
                      ? ListView(
                          children: [
                            SizedBox(
                              height: MediaQuery.of(context).size.height * 0.6,
                              child: AppEmptyState(
                                title: 'No listings yet',
                                message:
                                    'Create your first listing to start receiving rental requests.',
                                actionLabel: 'Create listing',
                                onAction: _createListing,
                                icon: Icons.add_business_outlined,
                              ),
                            ),
                          ],
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                          itemCount: _products.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 16),
                          itemBuilder: (context, index) {
                            final product = _products[index];
                            return ProductCard(
                              product: product,
                              onTap: () => _editListing(product),
                              trailing: PopupMenuButton<String>(
                                onSelected: (value) => _handleMenu(value, product),
                                itemBuilder: (context) {
                                  final items = <PopupMenuEntry<String>>[
                                    const PopupMenuItem(
                                      value: 'edit',
                                      child: Text('Edit'),
                                    ),
                                  ];

                                  final status = product.string('status');
                                  if (status == 'available' || status == 'unavailable') {
                                    items.add(
                                      PopupMenuItem(
                                        value: 'toggle',
                                        child: Text(
                                          status == 'available'
                                              ? 'Mark unavailable'
                                              : 'Mark available',
                                        ),
                                      ),
                                    );
                                  }

                                  items.add(
                                    const PopupMenuItem(
                                      value: 'delete',
                                      child: Text('Delete'),
                                    ),
                                  );

                                  return items;
                                },
                              ),
                            );
                          },
                        ),
                ),
    );
  }

  Future<void> _handleMenu(String action, JsonMap product) async {
    switch (action) {
      case 'edit':
        await _editListing(product);
        return;
      case 'toggle':
        await _toggleStatus(product);
        return;
      case 'delete':
        await _deleteListing(product);
        return;
    }
  }

  Future<void> _createListing() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => CreateListingScreen(
          dependencies: widget.dependencies,
          sessionController: widget.sessionController,
        ),
      ),
    );

    if (created == true) {
      await widget.sessionController.refreshProfile();
      await _load();
    }
  }

  Future<void> _editListing(JsonMap product) async {
    final updated = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => CreateListingScreen(
          dependencies: widget.dependencies,
          sessionController: widget.sessionController,
          existingProduct: product,
        ),
      ),
    );

    if (updated == true) {
      await _load();
    }
  }

  Future<void> _toggleStatus(JsonMap product) async {
    final currentStatus = product.string('status');
    final nextStatus = currentStatus == 'available' ? 'unavailable' : 'available';

    try {
      await widget.dependencies.products.updateProductStatus(
        id: product.string('id'),
        status: nextStatus,
      );
      await _load();
      _showSnack('Listing marked as ${AppFormatters.status(nextStatus)}.');
    } catch (error) {
      _showSnack(error.toString());
    }
  }

  Future<void> _deleteListing(JsonMap product) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete listing?'),
        content: Text(
          'This will permanently remove "${product.string('title')}" if it has no rental records.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed != true) {
      return;
    }

    try {
      await widget.dependencies.products.deleteProduct(product.string('id'));
      await _load();
      _showSnack('Listing deleted.');
    } catch (error) {
      _showSnack(error.toString());
    }
  }

  void _showSnack(String message) {
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }
}
