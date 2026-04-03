import 'package:flutter/material.dart';

import '../utils/formatters.dart';
import '../utils/json_utils.dart';
import 'app_network_image.dart';
import 'status_chip.dart';

class ProductCard extends StatelessWidget {
  const ProductCard({
    super.key,
    required this.product,
    required this.onTap,
    this.trailing,
  });

  final JsonMap product;
  final VoidCallback onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final images = product.jsonList('images');
    final image = images.isEmpty ? null : images.first;
    final owner = product.json('owner');

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                children: [
                  AppNetworkImage(
                    imageUrl: image?.nullableString('thumbnailUrl') ??
                        image?.nullableString('imageUrl'),
                    height: 180,
                    width: double.infinity,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  Positioned(
                    top: 12,
                    left: 12,
                    child: StatusChip(
                      label: AppFormatters.status(product.string('status')),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          product.string('title', fallback: 'Untitled listing'),
                          style:
                              Theme.of(context).textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w800,
                                  ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          product.nullableString('city') ?? 'Flexible location',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: Colors.black.withOpacity(0.65),
                              ),
                        ),
                      ],
                    ),
                  ),
                  if (trailing != null) trailing!,
                ],
              ),
              const SizedBox(height: 10),
              Text(
                product.nullableString('description') ?? 'No description yet.',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Colors.black.withOpacity(0.72),
                    ),
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _MetaPill(
                    icon: Icons.payments_outlined,
                    label: AppFormatters.primaryPrice(product),
                  ),
                  _MetaPill(
                    icon: Icons.star_border_rounded,
                    label: AppFormatters.ratingSummary(product),
                  ),
                  if (owner != null)
                    _MetaPill(
                      icon: Icons.verified_user_outlined,
                      label: owner.string('name', fallback: 'Owner'),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MetaPill extends StatelessWidget {
  const _MetaPill({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.04),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: Colors.black.withOpacity(0.65)),
          const SizedBox(width: 6),
          Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );
  }
}
